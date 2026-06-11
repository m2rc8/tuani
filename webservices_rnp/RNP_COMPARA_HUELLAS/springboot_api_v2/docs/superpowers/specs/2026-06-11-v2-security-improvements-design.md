# v2 Security & Hardening — Design Spec

**Date:** 2026-06-11  
**Project:** springboot_api_v2 (RNP fingerprint comparison API)  
**Scope:** Authentication, rate limiting, endpoint hardening, tests, Docker production setup

---

## Context

springboot_api_v2 is a Spring Boot 3.5 / Java 25 REST API that compares fingerprint images using SourceAFIS. It runs behind nginx/traefik in production (OCI or Docker Compose). Currently has no authentication, no rate limiting, a dangerous GET endpoint that leaks biometric data in query params, no tests, and an audit log that is lost on container restart.

---

## Goals

1. API key authentication on all endpoints (except health check)
2. Rate limiting: 50 req/sec per IP, burst of 100
3. Remove GET `/ValidateFinger/validate_fingerprint` (biometric data in query string)
4. Unit + integration test suite
5. Docker Compose with persistent volumes for audit log and fingerprint data
6. nginx config example for TLS termination

---

## Architecture

### New files

```
springboot_api_v2/
├── src/main/java/hn/rnp/springboot_api_v2/
│   └── security/
│       ├── ApiKeyAuthFilter.java
│       ├── RateLimitFilter.java
│       └── SecurityConfig.java
├── src/test/java/hn/rnp/springboot_api_v2/
│   ├── FingerprintComparisonServiceTest.java
│   └── FingerprintControllerIntegrationTest.java
├── src/test/resources/
│   └── application-test.properties
├── docker-compose.yml
├── nginx.conf
└── data/
    ├── huellas/.gitkeep
    └── logs/.gitkeep
```

### Modified files

```
springboot_api_v2/
├── build.gradle                          ← add bucket4j + spring-security deps
├── src/main/resources/application.properties  ← add auth + rate limit config keys
└── src/main/java/.../controller/FingerprintController.java  ← remove GET /ValidateFinger
```

---

## Section 1: Authentication

**Mechanism:** `OncePerRequestFilter` (`ApiKeyAuthFilter`) reads `X-API-Key` header on every request. Compares against configured value. Missing or wrong key → 401.

**Public routes (no auth required):**
- `GET /actuator/health`
- `GET /actuator/info`

**Config:**
```properties
app.security.api-key=${API_KEY:dev-key-insecure}
```

**401 response body:**
```json
{"error": "Unauthorized", "message": "Missing or invalid X-API-Key header"}
```

`SecurityConfig` disables CSRF (stateless API), disables session creation, registers both filters.

---

## Section 2: Rate Limiting

**Mechanism:** `RateLimitFilter` (also `OncePerRequestFilter`) uses bucket4j `InMemoryBucketStore`. One bucket per client IP. Runs after auth filter.

**Parameters:**
```properties
app.rate-limit.capacity=100
app.rate-limit.refill-per-second=50
```

**429 response body:**
```json
{"error": "Too Many Requests", "message": "Rate limit exceeded. Try again later."}
```

**Response headers added on every request:**
```
X-Rate-Limit-Remaining: <n>
X-Rate-Limit-Retry-After-Seconds: <n>   (only on 429)
```

**Constraint:** In-memory only — buckets reset on container restart. Multi-instance deployments need Redis backend (out of scope).

---

## Section 3: Endpoint Hardening

**Remove:** `@GetMapping("/ValidateFinger/validate_fingerprint")` and its handler `validateFingerprintLegacyGet()` from `FingerprintController`.

**Keep:** `@PostMapping("/ValidateFinger/validate_fingerprint")` with `application/x-www-form-urlencoded`.

**Result:** `GET /ValidateFinger/validate_fingerprint` → 405 Method Not Allowed.

**HTTPS:** Handled by nginx — no SSL config in Spring Boot JAR.

`nginx.conf` example:
```nginx
server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    location / {
        proxy_pass http://fingerprint-api:8080;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Spring Boot already reads `X-Forwarded-For` correctly in `RequestAuditService` — no changes needed there.

---

## Section 4: Tests

### Unit — `FingerprintComparisonServiceTest`

Uses demo PNG images already in repo (`php_emulator/_0_o_huellas/demo_1.png`, `demo_2.png`).

| Test | Expected |
|------|----------|
| compareBase64Json with valid same-finger images | score > 40, matches=true, resultado=Positivo |
| compareBase64Json with different fingers | score < 40, matches=false, resultado=Negativo |
| compareBase64Json with data-URL prefix | strips prefix, compares correctly |
| compareBase64Json with null huella1 | throws IllegalArgumentException |
| compareBase64Json with blank huella2 | throws IllegalArgumentException |
| compareBase64Json with invalid base64 | throws IllegalArgumentException |
| compareBase64Json with null dpi | resolves to 500 |

### Integration — `FingerprintControllerIntegrationTest`

Uses `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `TestRestTemplate` or `MockMvc`.

| Test | Expected |
|------|----------|
| POST /api/compare/base64 without X-API-Key | 401 |
| POST /api/compare/base64 with wrong key | 401 |
| POST /api/compare/base64 with valid key + valid payload | 200 + JSON result |
| POST /api/compare/base64 with valid key + missing huella1 | 400 |
| GET /actuator/health without key | 200 |
| POST /ValidateFinger/validate_fingerprint with valid key + form data | 200 |
| GET /ValidateFinger/validate_fingerprint | 405 |
| 101 rapid requests with valid key | last request returns 429 (test profile sets capacity=5 to avoid needing 101 real requests) |

### Test config — `application-test.properties`

```properties
app.security.api-key=test-key
app.rate-limit.capacity=5
app.rate-limit.refill-per-second=1
app.fingerprint.base-path=src/test/resources/huellas
app.audit.file-path=${java.io.tmpdir}/test-audit.log
```

Rate limit set low in test profile so the 429 test only needs 6 requests, not 101.

Test fingerprint images copied to `src/test/resources/huellas/`.

---

## Section 5: Docker + Persistent Volumes

**Problem:** Current audit log writes to `${user.dir}` inside container — lost on restart.

**Solution:** Mount `/data/logs` and `/data/huellas` as named volumes via Docker Compose.

### `docker-compose.yml`

```yaml
services:
  fingerprint-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - API_KEY=${API_KEY}
      - HUELLA_BASE_PATH=/data/huellas
      - AUDIT_FILE_PATH=/data/logs/requests-audit.log
    volumes:
      - ./data/huellas:/data/huellas
      - ./data/logs:/data/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - fingerprint-api
    restart: unless-stopped
```

`data/` must be added to `.dockerignore` — not currently excluded.

---

## Dependencies to add (`build.gradle`)

```groovy
implementation 'org.springframework.boot:spring-boot-starter-security'
implementation 'com.bucket4j:bucket4j-core:8.10.1'
```

No Spring Security auto-config for login pages needed — fully stateless, custom filter chain only.

---

## Out of Scope

- Redis-backed rate limiting (multi-instance)
- JWT / per-client API keys
- Rotating API keys without restart
- Observability / metrics endpoints beyond actuator health
