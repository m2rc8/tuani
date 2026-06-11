# v2 Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API key auth, per-IP rate limiting, remove unsafe GET endpoint, write unit+integration tests, and set up production Docker Compose with persistent volumes.

**Architecture:** Spring Security filter chain adds two filters before controllers — `ApiKeyAuthFilter` (auth) then `RateLimitFilter` (bucket4j in-memory, per IP). Tests use `@SpringBootTest` with an `test` profile and demo PNG images copied to test resources. Docker Compose mounts host directories for audit log and fingerprint data so data survives container restarts.

**Tech Stack:** Spring Boot 3.5, Spring Security 6, bucket4j-core 8.10.1, JUnit 5 + AssertJ, Docker Compose, nginx alpine

---

### Task 1: Dependencies, Config, and Test Images

**Files:**
- Modify: `springboot_api_v2/build.gradle`
- Modify: `springboot_api_v2/src/main/resources/application.properties`
- Create: `springboot_api_v2/src/test/resources/application-test.properties`

- [ ] **Step 1: Add dependencies to build.gradle**

Replace the `dependencies` block in `springboot_api_v2/build.gradle` with:

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'com.machinezoo.sourceafis:sourceafis:3.13.0'
    implementation 'com.bucket4j:bucket4j-core:8.10.1'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
}
```

- [ ] **Step 2: Add auth and rate limit config keys to application.properties**

Append to `springboot_api_v2/src/main/resources/application.properties`:

```properties
app.security.api-key=${API_KEY:dev-key-insecure}
app.rate-limit.capacity=100
app.rate-limit.refill-per-second=50
```

- [ ] **Step 3: Create application-test.properties**

Create `springboot_api_v2/src/test/resources/application-test.properties`:

```properties
app.security.api-key=test-key
app.rate-limit.capacity=5
app.rate-limit.refill-per-second=1
app.fingerprint.base-path=src/test/resources/huellas
app.audit.file-path=${java.io.tmpdir}/test-audit.log
```

Rate limit set low (capacity=5) so the 429 test only needs 6 requests.

- [ ] **Step 4: Copy demo images to test resources**

From repo root (`RNP_COMPARA_HUELLAS`), run in PowerShell:

```powershell
New-Item -ItemType Directory -Force "springboot_api_v2\src\test\resources\huellas"
Copy-Item "php_emulator\_0_o_huellas\demo_1.png" "springboot_api_v2\src\test\resources\huellas\"
Copy-Item "php_emulator\_0_o_huellas\demo_2.png" "springboot_api_v2\src\test\resources\huellas\"
```

- [ ] **Step 5: Verify Gradle resolves new dependencies**

```powershell
.\gradlew.bat -p .\springboot_api_v2 dependencies --configuration compileClasspath
```

Expected: output lists `spring-security-web`, `spring-security-config`, `bucket4j-core`.

- [ ] **Step 6: Commit**

```powershell
git add springboot_api_v2/build.gradle springboot_api_v2/src/main/resources/application.properties springboot_api_v2/src/test/resources/
git commit -m "build: add spring-security and bucket4j deps; test profile config and demo images"
```

---

### Task 2: TDD — Authentication

**Files:**
- Create: `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintControllerIntegrationTest.java`
- Create: `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/ApiKeyAuthFilter.java`
- Create: `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/SecurityConfig.java`

- [ ] **Step 1: Write failing auth tests**

Create `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintControllerIntegrationTest.java`:

```java
package hn.rnp.springboot_api_v2;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class FingerprintControllerIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    private static String demo1Base64;
    private static String demo2Base64;

    @BeforeAll
    static void loadImages() throws IOException {
        byte[] img1 = FingerprintControllerIntegrationTest.class
                .getResourceAsStream("/huellas/demo_1.png").readAllBytes();
        byte[] img2 = FingerprintControllerIntegrationTest.class
                .getResourceAsStream("/huellas/demo_2.png").readAllBytes();
        demo1Base64 = Base64.getEncoder().encodeToString(img1);
        demo2Base64 = Base64.getEncoder().encodeToString(img2);
    }

    private HttpHeaders keyHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.set("X-API-Key", "test-key");
        return h;
    }

    // --- Auth tests ---

    @Test
    void actuatorHealthIsPublic() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void requestWithoutApiKeyReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                Map.of("huella1", "x", "huella2", "y"), headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/compare/base64", entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void requestWithWrongApiKeyReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", "wrong-key");
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                Map.of("huella1", "x", "huella2", "y"), headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/compare/base64", entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintControllerIntegrationTest.requestWithoutApiKeyReturns401" --info
```

Expected: FAIL — returns 400 or 200, not 401.

- [ ] **Step 3: Create ApiKeyAuthFilter**

Create `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/ApiKeyAuthFilter.java`:

```java
package hn.rnp.springboot_api_v2.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    @Value("${app.security.api-key}")
    private String apiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String provided = request.getHeader("X-API-Key");
        if (apiKey.equals(provided)) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"error\":\"Unauthorized\",\"message\":\"Missing or invalid X-API-Key header\"}");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator/");
    }
}
```

- [ ] **Step 4: Create SecurityConfig**

Create `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/SecurityConfig.java`:

```java
package hn.rnp.springboot_api_v2.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final ApiKeyAuthFilter apiKeyAuthFilter;

    public SecurityConfig(ApiKeyAuthFilter apiKeyAuthFilter) {
        this.apiKeyAuthFilter = apiKeyAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(apiKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
```

- [ ] **Step 5: Run auth tests — verify they pass**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintControllerIntegrationTest" --info
```

Expected: `actuatorHealthIsPublic`, `requestWithoutApiKeyReturns401`, `requestWithWrongApiKeyReturns401` — all PASS.

- [ ] **Step 6: Commit**

```powershell
git add springboot_api_v2/src/
git commit -m "feat(security): API key auth via X-API-Key header; actuator paths public"
```

---

### Task 3: TDD — Rate Limiting

**Files:**
- Create: `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/RateLimitIntegrationTest.java`
- Create: `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/RateLimitFilter.java`
- Modify: `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/SecurityConfig.java`

- [ ] **Step 1: Write failing rate limit test**

Create `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/RateLimitIntegrationTest.java`:

```java
package hn.rnp.springboot_api_v2;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class RateLimitIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void afterExceedingCapacityReturns429() {
        // test profile: capacity=5, refill=1/sec
        // first 5 requests must not be rate-limited
        for (int i = 0; i < 5; i++) {
            ResponseEntity<String> r = restTemplate.getForEntity("/actuator/health", String.class);
            assertThat(r.getStatusCode())
                    .as("Request %d should not be rate limited", i + 1)
                    .isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        }
        // 6th request exceeds bucket
        ResponseEntity<String> last = restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(last.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(last.getHeaders().containsKey("X-Rate-Limit-Remaining")).isTrue();
        assertThat(last.getHeaders().containsKey("X-Rate-Limit-Retry-After-Seconds")).isTrue();
    }
}
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.RateLimitIntegrationTest" --info
```

Expected: FAIL — all 6 requests return 200, none 429.

- [ ] **Step 3: Create RateLimitFilter**

Create `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/security/RateLimitFilter.java`:

```java
package hn.rnp.springboot_api_v2.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${app.rate-limit.capacity:100}")
    private long capacity;

    @Value("${app.rate-limit.refill-per-second:50}")
    private long refillPerSecond;

    private Bandwidth bandwidth;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @PostConstruct
    void init() {
        bandwidth = Bandwidth.classic(capacity, Refill.greedy(refillPerSecond, Duration.ofSeconds(1)));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String ip = resolveIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> Bucket.builder().addLimit(bandwidth).build());

        if (bucket.tryConsume(1)) {
            response.setHeader("X-Rate-Limit-Remaining", String.valueOf(bucket.getAvailableTokens()));
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("X-Rate-Limit-Remaining", "0");
            response.setHeader("X-Rate-Limit-Retry-After-Seconds", "1");
            response.getWriter().write(
                    "{\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Try again later.\"}");
        }
    }

    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
```

- [ ] **Step 4: Register RateLimitFilter in SecurityConfig**

Replace the full content of `SecurityConfig.java`:

```java
package hn.rnp.springboot_api_v2.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final ApiKeyAuthFilter apiKeyAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(ApiKeyAuthFilter apiKeyAuthFilter, RateLimitFilter rateLimitFilter) {
        this.apiKeyAuthFilter = apiKeyAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(apiKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, ApiKeyAuthFilter.class)
                .build();
    }
}
```

- [ ] **Step 5: Run rate limit test — verify it passes**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.RateLimitIntegrationTest" --info
```

Expected: PASS — first 5 return 200, 6th returns 429 with rate limit headers.

- [ ] **Step 6: Run all tests**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```powershell
git add springboot_api_v2/src/
git commit -m "feat(security): per-IP rate limiting via bucket4j; capacity configurable via env"
```

---

### Task 4: Remove GET /ValidateFinger Endpoint

**Files:**
- Modify: `springboot_api_v2/src/main/java/hn/rnp/springboot_api_v2/controller/FingerprintController.java`
- Modify: `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintControllerIntegrationTest.java`

- [ ] **Step 1: Write failing 405 test**

Add this method to `FingerprintControllerIntegrationTest.java`:

```java
    @Test
    void getValidateFingerprintReturns405() {
        HttpHeaders headers = keyHeaders();

        ResponseEntity<String> response = restTemplate.exchange(
                "/ValidateFinger/validate_fingerprint",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    }
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintControllerIntegrationTest.getValidateFingerprintReturns405" --info
```

Expected: FAIL — GET currently returns 200.

- [ ] **Step 3: Remove GET handler from FingerprintController**

In `FingerprintController.java`, delete the entire `validateFingerprintLegacyGet` method and its `@GetMapping` annotation (currently lines 91–101). The `@PostMapping` on the same path stays.

After the edit, the only `/ValidateFinger/validate_fingerprint` mapping in the file is:

```java
    @PostMapping(value = "/ValidateFinger/validate_fingerprint", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public LegacyValidateResponse validateFingerprintLegacyPost(
            @RequestBody MultiValueMap<String, String> formData,
            HttpServletRequest request) {
        // ... existing body unchanged
    }
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintControllerIntegrationTest.getValidateFingerprintReturns405" --info
```

Expected: PASS — GET returns 405.

- [ ] **Step 5: Run all tests**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```powershell
git add springboot_api_v2/src/
git commit -m "feat(security): remove GET /ValidateFinger — biometric data must not be in query params"
```

---

### Task 5: Unit Tests — FingerprintComparisonService

**Files:**
- Create: `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintComparisonServiceTest.java`

- [ ] **Step 1: Write unit tests**

Create `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintComparisonServiceTest.java`:

```java
package hn.rnp.springboot_api_v2;

import hn.rnp.springboot_api_v2.model.FingerprintComparisonResult;
import hn.rnp.springboot_api_v2.service.FingerprintComparisonService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FingerprintComparisonServiceTest {

    private FingerprintComparisonService service;
    private String demo1Base64;

    @BeforeEach
    void setUp() throws IOException {
        service = new FingerprintComparisonService();
        ReflectionTestUtils.setField(service, "basePath", "src/test/resources/huellas");
        ReflectionTestUtils.setField(service, "threshold", 40.0);

        byte[] img1 = getClass().getResourceAsStream("/huellas/demo_1.png").readAllBytes();
        demo1Base64 = Base64.getEncoder().encodeToString(img1);
    }

    @Test
    void compareBase64JsonSameImageBothSidesIsPositivo() {
        FingerprintComparisonResult result = service.compareBase64Json("test", demo1Base64, demo1Base64, 500);

        assertThat(result.matches()).isTrue();
        assertThat(result.resultado()).isEqualTo("Positivo");
        assertThat(result.score()).isGreaterThan(40.0);
        assertThat(result.dpi()).isEqualTo(500);
        assertThat(result.threshold()).isEqualTo(40.0);
        assertThat(result.id()).isEqualTo("test");
    }

    @Test
    void compareBase64JsonWithDataUrlPrefixStripsPrefix() {
        String dataUrl = "data:image/png;base64," + demo1Base64;

        FingerprintComparisonResult result = service.compareBase64Json("test", dataUrl, dataUrl, 500);

        assertThat(result.matches()).isTrue();
    }

    @Test
    void compareBase64JsonWithNullDpiDefaultsTo500() {
        FingerprintComparisonResult result = service.compareBase64Json("test", demo1Base64, demo1Base64, null);

        assertThat(result.dpi()).isEqualTo(500);
    }

    @Test
    void compareBase64JsonWithZeroDpiDefaultsTo500() {
        FingerprintComparisonResult result = service.compareBase64Json("test", demo1Base64, demo1Base64, 0);

        assertThat(result.dpi()).isEqualTo(500);
    }

    @Test
    void compareBase64JsonWithNullIdDefaultsToRequest() {
        FingerprintComparisonResult result = service.compareBase64Json(null, demo1Base64, demo1Base64, 500);

        assertThat(result.id()).isEqualTo("request");
    }

    @Test
    void compareBase64JsonWithBlankIdDefaultsToRequest() {
        FingerprintComparisonResult result = service.compareBase64Json("  ", demo1Base64, demo1Base64, 500);

        assertThat(result.id()).isEqualTo("request");
    }

    @Test
    void compareBase64JsonWithNullHuella1Throws() {
        assertThatThrownBy(() -> service.compareBase64Json("test", null, demo1Base64, 500))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("huella1");
    }

    @Test
    void compareBase64JsonWithBlankHuella2Throws() {
        assertThatThrownBy(() -> service.compareBase64Json("test", demo1Base64, "   ", 500))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("huella2");
    }

    @Test
    void compareBase64JsonWithInvalidBase64Throws() {
        assertThatThrownBy(() -> service.compareBase64Json("test", "not-valid-base64!!!", demo1Base64, 500))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid base64");
    }
}
```

- [ ] **Step 2: Run unit tests**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintComparisonServiceTest" --info
```

Expected: All 9 tests PASS.

- [ ] **Step 3: Commit**

```powershell
git add springboot_api_v2/src/test/
git commit -m "test: unit tests for FingerprintComparisonService — input validation and defaults"
```

---

### Task 6: Complete Integration Tests

**Files:**
- Modify: `springboot_api_v2/src/test/java/hn/rnp/springboot_api_v2/FingerprintControllerIntegrationTest.java`

- [ ] **Step 1: Add remaining integration tests**

Add these methods to `FingerprintControllerIntegrationTest.java` (inside the class, after existing tests):

```java
    @Test
    void compareBase64WithValidKeyAndImagesReturns200() {
        HttpHeaders headers = keyHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "id", "integration-test",
                "huella1", demo1Base64,
                "huella2", demo2Base64,
                "dpi", 500
        );

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/compare/base64",
                new HttpEntity<>(body, headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("resultado");
        assertThat(response.getBody()).contains("score");
    }

    @Test
    void compareBase64WithMissingHuella1Returns400() {
        HttpHeaders headers = keyHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of("huella2", demo2Base64, "dpi", 500);

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/compare/base64",
                new HttpEntity<>(body, headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void postValidateFingerprintWithValidKeyReturns200() {
        HttpHeaders headers = keyHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        org.springframework.util.LinkedMultiValueMap<String, String> form =
                new org.springframework.util.LinkedMultiValueMap<>();
        form.add("huella1", demo1Base64);
        form.add("huella2", demo2Base64);
        form.add("dpi", "500");

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/ValidateFinger/validate_fingerprint",
                new HttpEntity<>(form, headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("type");
        assertThat(response.getBody()).contains("resp");
    }
```

- [ ] **Step 2: Run integration tests**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test --tests "hn.rnp.springboot_api_v2.FingerprintControllerIntegrationTest" --info
```

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

```powershell
.\gradlew.bat -p .\springboot_api_v2 test
```

Expected: BUILD SUCCESSFUL — all tests across all classes pass.

- [ ] **Step 4: Commit**

```powershell
git add springboot_api_v2/src/test/
git commit -m "test: complete integration tests — base64 endpoint, legacy POST, 400 validation"
```

---

### Task 7: Docker Compose, nginx, .dockerignore

**Files:**
- Create: `springboot_api_v2/docker-compose.yml`
- Create: `springboot_api_v2/nginx.conf`
- Create: `springboot_api_v2/data/huellas/.gitkeep`
- Create: `springboot_api_v2/data/logs/.gitkeep`
- Modify: `springboot_api_v2/.dockerignore`

- [ ] **Step 1: Create docker-compose.yml**

Create `springboot_api_v2/docker-compose.yml`:

```yaml
services:
  fingerprint-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - API_KEY=${API_KEY:?API_KEY env var is required}
      - HUELLA_BASE_PATH=/data/huellas
      - AUDIT_FILE_PATH=/data/logs/requests-audit.log
    volumes:
      - ./data/huellas:/data/huellas
      - ./data/logs:/data/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      fingerprint-api:
        condition: service_healthy
    restart: unless-stopped
```

- [ ] **Step 2: Create nginx.conf**

Create `springboot_api_v2/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://fingerprint-api:8080;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

- [ ] **Step 3: Create data directory placeholders**

```powershell
New-Item -ItemType File -Force "springboot_api_v2\data\huellas\.gitkeep"
New-Item -ItemType File -Force "springboot_api_v2\data\logs\.gitkeep"
```

- [ ] **Step 4: Update .dockerignore**

Replace full content of `springboot_api_v2/.dockerignore`:

```
.git
.gradle
.vscode
.idea
**/*.iml
src/test/
README.md
data/
docs/
```

- [ ] **Step 5: Verify Docker Compose build**

Build JAR first:

```powershell
.\gradlew.bat -p .\springboot_api_v2 bootJar
```

Then test image build:

```powershell
cd springboot_api_v2
docker compose build
```

Expected: image builds successfully with no errors.

- [ ] **Step 6: Commit**

```powershell
cd ..
git add springboot_api_v2/docker-compose.yml springboot_api_v2/nginx.conf springboot_api_v2/.dockerignore springboot_api_v2/data/
git commit -m "feat(docker): compose with persistent volumes; nginx TLS config; fix .dockerignore"
```
