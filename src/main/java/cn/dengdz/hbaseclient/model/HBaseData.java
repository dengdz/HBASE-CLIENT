package cn.dengdz.hbaseclient.model;

import java.util.Map;

public class HBaseData {
    private String rowKey;
    private Map<String, Map<String, String>> familyMap;

    public String getRowKey() {
        return rowKey;
    }

    public void setRowKey(String rowKey) {
        this.rowKey = rowKey;
    }

    public Map<String, Map<String, String>> getFamilyMap() {
        return familyMap;
    }

    public void setFamilyMap(Map<String, Map<String, String>> familyMap) {
        this.familyMap = familyMap;
    }
} 