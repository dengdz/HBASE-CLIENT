package cn.dengdz.hbaseclient.controller;

import cn.dengdz.hbaseclient.model.HBaseData;
import cn.dengdz.hbaseclient.service.HBaseService;
import cn.dengdz.hbaseclient.util.DataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class HBaseController {

    @Autowired
    private HBaseService hbaseService;

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody Map<String, String> request) {
        try {
            String zkQuorum = request.get("host");
            hbaseService.connect(zkQuorum);

            List<String> tables = hbaseService.listTables();

            Map<String, Object> response = new HashMap<>();
            response.put("message", "连接成功");
            response.put("tables", tables);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/query")
    public ResponseEntity<?> query(@RequestParam String table, @RequestParam String rowkey) {
        try {
            HBaseData data = hbaseService.getRow(table, rowkey);
            return ResponseEntity.ok(data.getFamilyMap());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping("/upload-config")
    public ResponseEntity<?> uploadConfig(@RequestParam("core-site") MultipartFile coreSite,
                                        @RequestParam("hbase-site") MultipartFile hbaseSite) {
        try {
            hbaseService.uploadConfig(coreSite, hbaseSite);
            return ResponseEntity.ok(Collections.singletonMap("message", "配置文件上传成功"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/check-config")
    public ResponseEntity<?> checkConfig() {
        try {
            boolean configured = hbaseService.checkConfigExists();
            return ResponseEntity.ok(Collections.singletonMap("configured", configured));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/list-rows")
    public ResponseEntity<?> listRows(@RequestParam String table, @RequestParam(defaultValue = "100") int limit) {
        try {
            List<String> rowkeys = hbaseService.listRows(table, limit);
            return ResponseEntity.ok(Collections.singletonMap("rowkeys", rowkeys));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @DeleteMapping("/datasource/{id}")
    public ResponseEntity<?> deleteDataSource(@PathVariable String id) {
        try {
            hbaseService.deleteConfig(id);
            return ResponseEntity.ok(Collections.singletonMap("message", "数据源已删除"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping("/datasource/{id}/reconnect")
    public ResponseEntity<?> reconnect(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            DataSourceContext.setCurrentDataSourceId(id);
            String zkQuorum = request.get("host");
            hbaseService.reconnect(id, zkQuorum);
            List<String> tables = hbaseService.listTables();
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "重新连接成功");
            response.put("tables", tables);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } finally {
            DataSourceContext.clear();
        }
    }

    @PostMapping("/datasource/{id}/upload-config")
    public ResponseEntity<?> uploadConfig(@PathVariable String id,
                                        @RequestParam("core-site") MultipartFile coreSite,
                                        @RequestParam("hbase-site") MultipartFile hbaseSite) {
        try {
            DataSourceContext.setCurrentDataSourceId(id);
            hbaseService.uploadConfig(coreSite, hbaseSite);
            return ResponseEntity.ok(Collections.singletonMap("message", "配置文件上传成功"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } finally {
            DataSourceContext.clear();
        }
    }

    @PostMapping("/datasource/{id}/connect")
    public ResponseEntity<?> connect(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            DataSourceContext.setCurrentDataSourceId(id);
            String zkQuorum = request.get("host");
            
            if (!hbaseService.checkConfigExists()) {
                throw new Exception("配置文件不存在，请先上传配置文件");
            }
            
            hbaseService.connect(zkQuorum);
            List<String> tables = hbaseService.listTables();

            Map<String, Object> response = new HashMap<>();
            response.put("message", "连接成功");
            response.put("tables", tables);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } finally {
            DataSourceContext.clear();
        }
    }

    @GetMapping("/datasource/{id}/list-rows")
    public ResponseEntity<?> listRows(@PathVariable String id, 
                                    @RequestParam String table,
                                    @RequestParam(required = false) String rowkey,
                                    @RequestParam(required = false, defaultValue = "100") int limit) {
        try {
            DataSourceContext.setCurrentDataSourceId(id);
            List<String> rowkeys;
            
            if (rowkey != null && !rowkey.trim().isEmpty()) {
                // 如果指定了rowkey，只返回匹配的结果
                rowkeys = hbaseService.searchRows(table, rowkey);
            } else {
                // 否则返回前limit条
                rowkeys = hbaseService.listRows(table, limit);
            }
            
            return ResponseEntity.ok(Collections.singletonMap("rowkeys", rowkeys));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } finally {
            DataSourceContext.clear();
        }
    }

    @GetMapping("/datasource/{id}/query")
    public ResponseEntity<?> query(@PathVariable String id,
                                 @RequestParam String table, 
                                 @RequestParam String rowkey) {
        try {
            DataSourceContext.setCurrentDataSourceId(id);
            HBaseData data = hbaseService.getRow(table, rowkey);
            return ResponseEntity.ok(data.getFamilyMap());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        } finally {
            DataSourceContext.clear();
        }
    }
} 