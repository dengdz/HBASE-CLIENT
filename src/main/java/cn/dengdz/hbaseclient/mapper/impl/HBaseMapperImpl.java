package cn.dengdz.hbaseclient.mapper.impl;

import cn.dengdz.hbaseclient.mapper.HBaseMapper;
import cn.dengdz.hbaseclient.model.HBaseData;
import cn.dengdz.hbaseclient.util.DataSourceContext;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.hbase.HBaseConfiguration;
import org.apache.hadoop.hbase.TableName;
import org.apache.hadoop.hbase.client.*;
import org.apache.hadoop.hbase.util.Bytes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;
import javax.annotation.PreDestroy;
import org.apache.commons.io.FileUtils;
import org.springframework.web.multipart.MultipartFile;
import cn.dengdz.hbaseclient.config.StorageConfig;
import org.springframework.beans.factory.annotation.Autowired;

@Repository
public class HBaseMapperImpl implements HBaseMapper {
    
    private static final Logger log = LoggerFactory.getLogger(HBaseMapperImpl.class);
    
    private Connection connection;
    private Configuration configuration;
    private final StorageConfig storageConfig;
    private String currentDataSourceId;

    @Autowired
    public HBaseMapperImpl(StorageConfig storageConfig) {
        this.storageConfig = storageConfig;
        // 创建基础配置目录
        try {
            Files.createDirectories(Paths.get(storageConfig.getConfigBasePath()));
        } catch (IOException e) {
            throw new RuntimeException("无法创建配置目录", e);
        }
    }

    @Override
    public void uploadConfig(String dataSourceId, MultipartFile coreSite, MultipartFile hbaseSite) throws Exception {
        try {
            // 获取数据源配置目录的完整路径
            java.nio.file.Path configDir = Paths.get(storageConfig.getConfigPath(dataSourceId));

            log.info("正在上传配置文件至：{}", configDir);
            
            // 如果目录已存在，先删除
            if (Files.exists(configDir)) {
                log.info("删除现有的配置目录");
                FileUtils.deleteDirectory(configDir.toFile());
            }
            
            // 创建新目录
            Files.createDirectories(configDir);
            
            // 保存配置文件
            java.nio.file.Path coreSitePath = configDir.resolve("core-site.xml");
            java.nio.file.Path hbaseSitePath = configDir.resolve("hbase-site.xml");
            
            Files.copy(coreSite.getInputStream(), coreSitePath, StandardCopyOption.REPLACE_EXISTING);
            Files.copy(hbaseSite.getInputStream(), hbaseSitePath, StandardCopyOption.REPLACE_EXISTING);
            
            log.info("配置文件上传成功");
            log.info("core-site.xml 保存至：{}", coreSitePath);
            log.info("hbase-site.xml保存至：{}", hbaseSitePath);
        } catch (IOException e) {
            log.error("无法上传配置文件：{}", e.getMessage());
            e.printStackTrace();
            throw new Exception("保存配置文件失败: " + e.getMessage());
        }
    }

    @Override
    public void deleteConfig(String dataSourceId) throws Exception {
        String configPath = storageConfig.getConfigPath(dataSourceId);
        FileUtils.deleteDirectory(new File(configPath));
    }

    @Override
    public boolean checkConfigExists(String dataSourceId) throws Exception {
        java.nio.file.Path configDir = Paths.get(storageConfig.getConfigPath(dataSourceId));
        return Files.exists(configDir.resolve("core-site.xml")) && 
               Files.exists(configDir.resolve("hbase-site.xml"));
    }

    @Override
    public void reconnect(String dataSourceId, String zkQuorum) throws Exception {
        try {
            if (connection != null && !connection.isClosed()) {
                connection.close();
            }

            // 保存当前数据源ID
            this.currentDataSourceId = dataSourceId;

            // 获取配置文件路径
            java.nio.file.Path configDir = Paths.get(storageConfig.getConfigPath(dataSourceId));
            java.nio.file.Path coreSitePath = configDir.resolve("core-site.xml");
            java.nio.file.Path hbaseSitePath = configDir.resolve("hbase-site.xml");

            // 检查配置文件是否存在
            if (!Files.exists(coreSitePath) || !Files.exists(hbaseSitePath)) {
                throw new IllegalStateException("配置文件不存在，请先上传配置文件");
            }

            // 创建新的配置
            configuration = HBaseConfiguration.create();
            
            // 添加配置文件
            log.info("从以下位置加载 core-site.xml：{}", coreSitePath);
            log.info("从以下位置加载 hbase-site.xml：{}", hbaseSitePath);
            
            configuration.addResource(new Path(coreSitePath.toUri()));
            configuration.addResource(new Path(hbaseSitePath.toUri()));

            // 设置 ZooKeeper 配置
            String[] zkNodes = zkQuorum.split(",");
            String zkHosts = Arrays.stream(zkNodes)
                    .map(node -> node.split(":")[0])
                    .collect(Collectors.joining(","));
            String zkPort = zkNodes[0].split(":")[1];

            log.info("设置 ZooKeeper 配置：");
            log.info("hbase.zookeeper.quorum：{}", zkHosts);
            log.info("hbase.zookeeper.property.clientPort: {}", zkPort);

            configuration.set("hbase.zookeeper.quorum", zkHosts);
            configuration.set("hbase.zookeeper.property.clientPort", zkPort);
            
            // 设置其他必要的配置
            configuration.set("hbase.cluster.distributed", "true");
            configuration.set("hbase.rpc.timeout", "60000");
            configuration.set("hbase.client.operation.timeout", "60000");
            configuration.set("hbase.client.scanner.timeout.period", "60000");
            configuration.set("zookeeper.recovery.retry", "3");
            configuration.set("zookeeper.recovery.retry.intervalmill", "1000");

            try {
                // 创建新连接
                log.info("正在尝试创建 HBase 连接...");
                connection = ConnectionFactory.createConnection(configuration);
                log.info("HBase 连接创建成功");
            } catch (Exception e) {
                log.error("无法创建 HBase 连接：{}", e.getMessage());
                e.printStackTrace();
                throw new Exception("创建 HBase 连接失败: " + e.getMessage());
            }
        } catch (Exception e) {
            log.error("重新连接失败：{}", e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @Override
    public void initConnection(String zkQuorum) throws Exception {
        if (currentDataSourceId == null) {
            currentDataSourceId = DataSourceContext.getCurrentDataSourceId();
            if (currentDataSourceId == null) {
                throw new IllegalStateException("未设置当前数据源ID");
            }
        }
        reconnect(currentDataSourceId, zkQuorum);
    }

    @Override
    public List<String> listTables() throws Exception {
        try (Admin admin = connection.getAdmin()) {
            return Arrays.stream(admin.listTableNames())
                    .map(TableName::getNameAsString)
                    .collect(Collectors.toList());
        }
    }

    @Override
    public HBaseData getRow(String tableName, String rowKey) throws Exception {
        try (Table table = connection.getTable(TableName.valueOf(tableName))) {
            Get get = new Get(Bytes.toBytes(rowKey));
            Result result = table.get(get);
            
            HBaseData hbaseData = new HBaseData();
            hbaseData.setRowKey(rowKey);
            
            Map<String, Map<String, String>> familyMap = new HashMap<>();
            
            if (!result.isEmpty()) {
                // 获取所有列族
                for (byte[] family : result.getMap().keySet()) {
                    String familyName = Bytes.toString(family);
                    Map<String, String> qualifierMap = new HashMap<>();
                    
                    // 获取该列族下的所有列限定符和值
                    NavigableMap<byte[], byte[]> qualifiers = result.getFamilyMap(family);
                    for (Map.Entry<byte[], byte[]> entry : qualifiers.entrySet()) {
                        String qualifier = Bytes.toString(entry.getKey());
                        String value = Bytes.toString(entry.getValue());
                        qualifierMap.put(qualifier, value);
                    }
                    
                    familyMap.put(familyName, qualifierMap);
                }
            }
            
            hbaseData.setFamilyMap(familyMap);
            return hbaseData;
        }
    }

    @Override
    public void closeConnection() throws Exception {
        Optional.ofNullable(connection)
                .filter(conn -> !conn.isClosed())
                .ifPresent(conn -> {
                    try {
                        conn.close();
                    } catch (Exception e) {
                        throw new RuntimeException("关闭连接失败", e);
                    }
                });
    }

    @PreDestroy
    public void destroy() {
        try {
            closeConnection();
            // 清理配置文件
            FileUtils.deleteDirectory(new File(storageConfig.getConfigBasePath()));
        } catch (Exception e) {
            // 记录错误但不抛出
            e.printStackTrace();
        }
    }

    @Override
    public List<String> listRows(String tableName, int limit) throws Exception {
        List<String> rowkeys = new ArrayList<>();
        
        try (Table table = connection.getTable(TableName.valueOf(tableName));
             ResultScanner scanner = table.getScanner(new Scan().setLimit(limit))) {
            
            for (Result result : scanner) {
                rowkeys.add(Bytes.toString(result.getRow()));
            }
            
            return rowkeys;
        } catch (Exception e) {
            throw new Exception("获取RowKey列表失败: " + e.getMessage(), e);
        }
    }

    @Override
    public List<String> searchRows(String tableName, String rowkey) throws Exception {
        List<String> rowkeys = new ArrayList<>();
        
        try (Table table = connection.getTable(TableName.valueOf(tableName))) {
            // 创建一个扫描器，设置起始rowkey
            Scan scan = new Scan()
                .setRowPrefixFilter(Bytes.toBytes(rowkey))
                .setLimit(10); // 限制最多返回10个匹配结果
            
            try (ResultScanner scanner = table.getScanner(scan)) {
                for (Result result : scanner) {
                    rowkeys.add(Bytes.toString(result.getRow()));
                }
            }
            
            return rowkeys;
        } catch (Exception e) {
            throw new Exception("搜索RowKey失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void addData(String table, String rowKey, String columnFamily, String column, String value) throws Exception {
        try (Table hTable = connection.getTable(TableName.valueOf(table))) {
            Put put = new Put(Bytes.toBytes(rowKey));
            put.addColumn(
                Bytes.toBytes(columnFamily),
                Bytes.toBytes(column),
                Bytes.toBytes(value)
            );
            
            hTable.put(put);
        } catch (Exception e) {
            throw new Exception("添加数据失败: " + e.getMessage());
        }
    }

    @Override
    public void deleteData(String table, String rowKey) throws Exception {
        try (Table hTable = connection.getTable(TableName.valueOf(table))) {
            Delete delete = new Delete(Bytes.toBytes(rowKey));
            hTable.delete(delete);
        } catch (Exception e) {
            throw new Exception("删除数据失败: " + e.getMessage());
        }
    }

    @Override
    public void addColumnFamily(String tableName, String familyName) throws Exception {
        try {
            Admin admin = connection.getAdmin();
            TableName table = TableName.valueOf(tableName);
            
            // 检查表是否存在
            if (!admin.tableExists(table)) {
                throw new IOException("表不存在");
            }
            
            // 添加列簇
            ColumnFamilyDescriptor columnFamilyDescriptor = 
                ColumnFamilyDescriptorBuilder.newBuilder(Bytes.toBytes(familyName)).build();
            admin.addColumnFamily(table, columnFamilyDescriptor);
        } catch (Exception e) {
            throw new Exception("添加列簇失败: " + e.getMessage());
        }
    }
} 