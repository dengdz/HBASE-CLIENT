package cn.dengdz.hbaseclient.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StorageConfig {
    @Value("${storage.config-path:${user.home}/.hbase-client/configs}")
    private String configBasePath;

    public String getConfigPath(String dataSourceId) {
        return configBasePath + "/" + dataSourceId;
    }

    public String getConfigBasePath() {
        return configBasePath;
    }
} 