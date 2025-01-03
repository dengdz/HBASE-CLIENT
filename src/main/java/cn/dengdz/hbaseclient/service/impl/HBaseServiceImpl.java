package cn.dengdz.hbaseclient.service.impl;

import cn.dengdz.hbaseclient.mapper.HBaseMapper;
import cn.dengdz.hbaseclient.model.HBaseData;
import cn.dengdz.hbaseclient.service.HBaseService;
import cn.dengdz.hbaseclient.util.DataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class HBaseServiceImpl implements HBaseService {

    @Autowired
    private HBaseMapper hbaseMapper;

    @Override
    public void connect(String zkQuorum) throws Exception {
        String dataSourceId = DataSourceContext.getCurrentDataSourceId();
        if (dataSourceId == null) {
            throw new IllegalStateException("未设置当前数据源ID");
        }
        hbaseMapper.initConnection(zkQuorum);
    }

    @Override
    public List<String> listTables() throws Exception {
        return hbaseMapper.listTables();
    }

    @Override
    public HBaseData getRow(String tableName, String rowKey) throws Exception {
        return hbaseMapper.getRow(tableName, rowKey);
    }

    @Override
    public void close() throws Exception {
        hbaseMapper.closeConnection();
    }

    @Override
    public void uploadConfig(MultipartFile coreSite, MultipartFile hbaseSite) throws Exception {
        String dataSourceId = getCurrentDataSourceId();
        hbaseMapper.uploadConfig(dataSourceId, coreSite, hbaseSite);
    }

    @Override
    public boolean checkConfigExists() throws Exception {
        String dataSourceId = getCurrentDataSourceId();
        return hbaseMapper.checkConfigExists(dataSourceId);
    }

    @Override
    public List<String> listRows(String tableName, int limit) throws Exception {
        return hbaseMapper.listRows(tableName, limit);
    }

    @Override
    public void deleteConfig(String dataSourceId) throws Exception {
        hbaseMapper.deleteConfig(dataSourceId);
    }

    @Override
    public void reconnect(String dataSourceId, String zkQuorum) throws Exception {
        hbaseMapper.reconnect(dataSourceId, zkQuorum);
    }

    @Override
    public List<String> searchRows(String tableName, String rowkey) throws Exception {
        return hbaseMapper.searchRows(tableName, rowkey);
    }

    private String getCurrentDataSourceId() {
        String dataSourceId = DataSourceContext.getCurrentDataSourceId();
        if (dataSourceId == null) {
            throw new IllegalStateException("未设置当前数据源ID");
        }
        return dataSourceId;
    }
} 