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
            
            System.out.println("Uploading config files to: " + configDir);
            
            // 如果目录已存在，先删除
            if (Files.exists(configDir)) {
                System.out.println("Deleting existing config directory");
                FileUtils.deleteDirectory(configDir.toFile());
            }
            
            // 创建新目录
            Files.createDirectories(configDir);
            
            // 保存配置文件
            java.nio.file.Path coreSitePath = configDir.resolve("core-site.xml");
            java.nio.file.Path hbaseSitePath = configDir.resolve("hbase-site.xml");
            
            Files.copy(coreSite.getInputStream(), coreSitePath, StandardCopyOption.REPLACE_EXISTING);
            Files.copy(hbaseSite.getInputStream(), hbaseSitePath, StandardCopyOption.REPLACE_EXISTING);
            
            System.out.println("Config files uploaded successfully");
            System.out.println("core-site.xml saved to: " + coreSitePath);
            System.out.println("hbase-site.xml saved to: " + hbaseSitePath);
        } catch (IOException e) {
            System.err.println("Failed to upload config files: " + e.getMessage());
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
            System.out.println("Loading core-site.xml from: " + coreSitePath);
            System.out.println("Loading hbase-site.xml from: " + hbaseSitePath);
            
            configuration.addResource(new Path(coreSitePath.toUri()));
            configuration.addResource(new Path(hbaseSitePath.toUri()));

            // 设置 ZooKeeper 配置
            String[] zkNodes = zkQuorum.split(",");
            String zkHosts = Arrays.stream(zkNodes)
                    .map(node -> node.split(":")[0])
                    .collect(Collectors.joining(","));
            String zkPort = zkNodes[0].split(":")[1];

            System.out.println("Setting ZooKeeper configuration:");
            System.out.println("hbase.zookeeper.quorum: " + zkHosts);
            System.out.println("hbase.zookeeper.property.clientPort: " + zkPort);

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
                System.out.println("Attempting to create HBase connection...");
                connection = ConnectionFactory.createConnection(configuration);
                System.out.println("HBase connection created successfully");
            } catch (Exception e) {
                System.err.println("Failed to create HBase connection: " + e.getMessage());
                e.printStackTrace();
                throw new Exception("创建 HBase 连接失败: " + e.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Reconnection failed: " + e.getMessage());
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
} 