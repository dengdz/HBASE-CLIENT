package cn.dengdz.hbaseclient.mapper;

import cn.dengdz.hbaseclient.model.HBaseData;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import org.apache.hadoop.hbase.HBaseConfiguration;
import org.apache.hadoop.hbase.client.Admin;
import org.apache.hadoop.hbase.client.Connection;
import org.apache.hadoop.hbase.client.ConnectionFactory;
import org.apache.hadoop.hbase.client.Table;
import org.apache.hadoop.hbase.client.TableDescriptor;
import org.apache.hadoop.hbase.client.TableDescriptorBuilder;
import org.apache.hadoop.hbase.util.Bytes;
import org.apache.hadoop.hbase.client.ColumnFamilyDescriptor;
import org.apache.hadoop.hbase.client.ColumnFamilyDescriptorBuilder;
import org.apache.hadoop.hbase.TableName;

public interface HBaseMapper {
    void initConnection(String zkQuorum) throws Exception;
    List<String> listTables() throws Exception;
    HBaseData getRow(String tableName, String rowKey) throws Exception;
    void closeConnection() throws Exception;
    void uploadConfig(String dataSourceId, MultipartFile coreSite, MultipartFile hbaseSite) throws Exception;
    void deleteConfig(String dataSourceId) throws Exception;
    boolean checkConfigExists(String dataSourceId) throws Exception;
    void reconnect(String dataSourceId, String zkQuorum) throws Exception;
    List<String> listRows(String tableName, int limit) throws Exception;
    List<String> searchRows(String tableName, String rowkey) throws Exception;
    void addData(String table, String rowKey, String columnFamily, String column, String value) throws Exception;
    void deleteData(String table, String rowKey) throws Exception;
    void addColumnFamily(String tableName, String familyName) throws Exception;
} 