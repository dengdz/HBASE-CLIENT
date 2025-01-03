package cn.dengdz.hbaseclient.util;

public class DataSourceContext {
    private static final ThreadLocal<String> currentDataSourceId = new ThreadLocal<>();

    public static void setCurrentDataSourceId(String dataSourceId) {
        currentDataSourceId.set(dataSourceId);
    }

    public static String getCurrentDataSourceId() {
        return currentDataSourceId.get();
    }

    public static void clear() {
        currentDataSourceId.remove();
    }
} 