package cn.dengdz.hbaseclient.service;

import cn.dengdz.hbaseclient.model.HBaseData;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import org.apache.hadoop.hbase.TableName;
import org.apache.hadoop.hbase.client.Admin;
import org.apache.hadoop.hbase.client.ColumnFamilyDescriptor;
import org.apache.hadoop.hbase.client.ColumnFamilyDescriptorBuilder;
import org.apache.hadoop.hbase.util.Bytes;

public interface HBaseService {
    void connect(String zkQuorum) throws Exception;
    List<String> listTables() throws Exception;
    HBaseData getRow(String tableName, String rowKey) throws Exception;
    void close() throws Exception;
    void uploadConfig(MultipartFile coreSite, MultipartFile hbaseSite) throws Exception;
    boolean checkConfigExists() throws Exception;
    List<String> listRows(String tableName, int limit) throws Exception;
    void deleteConfig(String dataSourceId) throws Exception;
    void reconnect(String dataSourceId, String zkQuorum) throws Exception;
    List<String> searchRows(String tableName, String rowkey) throws Exception;
    void addData(String table, String rowKey, String columnFamily, String column, String value) throws Exception;
    void deleteData(String table, String rowKey) throws Exception;
    void addColumnFamily(String tableName, String familyName) throws Exception;
} 