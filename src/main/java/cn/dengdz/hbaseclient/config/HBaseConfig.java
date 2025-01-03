package cn.dengdz.hbaseclient.config;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.hbase.HBaseConfiguration;
import org.apache.hadoop.hbase.client.Connection;
import org.apache.hadoop.hbase.client.ConnectionFactory;
import org.springframework.stereotype.Component;

@Component
public class HBaseConfig {
    private Connection connection;
    private Configuration configuration;

    public void initConnection(String zkQuorum) throws Exception {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
        
        configuration = HBaseConfiguration.create();
        configuration.set("hbase.zookeeper.quorum", zkQuorum);
        configuration.set("hbase.zookeeper.property.clientPort", "2181");
        
        connection = ConnectionFactory.createConnection(configuration);
    }

    public Connection getConnection() {
        return connection;
    }

    public void closeConnection() throws Exception {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
    }
} 