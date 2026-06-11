package hn.rnp.springboot_api_v2.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;

@Service
public class RequestAuditService {

    private static final Logger logger = LoggerFactory.getLogger(RequestAuditService.class);
    private final ObjectMapper objectMapper;

    public RequestAuditService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Value("${app.audit.file-path:${user.dir}/springboot_api_v2/logs/requests-audit.log}")
    private String auditFilePath;

    public synchronized void audit(String requestId, String endpoint, String requesterIp, String caller, String resultType, String score, String details) {
        String line = buildJsonLine(requestId, endpoint, requesterIp, caller, resultType, score, details) + System.lineSeparator();

        try {
            Path path = Path.of(auditFilePath);
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(path, line, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ex) {
            logger.error("Failed to write audit log file", ex);
        }
    }

    private String buildJsonLine(String requestId, String endpoint, String requesterIp, String caller, String resultType, String score, String details) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("timestamp", OffsetDateTime.now().toString());
        payload.put("requestId", sanitize(requestId));
        payload.put("endpoint", sanitize(endpoint));
        payload.put("ip", sanitize(requesterIp));
        payload.put("caller", sanitize(caller));
        payload.put("type", sanitize(resultType));
        payload.put("score", sanitize(score));
        payload.put("details", sanitize(details));

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            logger.error("Failed to serialize audit payload", ex);
            return "{\"timestamp\":\"" + OffsetDateTime.now() + "\",\"type\":\"error\",\"details\":\"audit-serialization-failed\"}";
        }
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        return value.replace('\n', ' ').replace('\r', ' ').trim();
    }
}
