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
        var stream1 = FingerprintControllerIntegrationTest.class.getResourceAsStream("/huellas/demo_1.png");
        var stream2 = FingerprintControllerIntegrationTest.class.getResourceAsStream("/huellas/demo_2.png");
        if (stream1 == null || stream2 == null) throw new IllegalStateException("Demo fingerprint images missing from test resources");
        byte[] img1 = stream1.readAllBytes();
        byte[] img2 = stream2.readAllBytes();
        demo1Base64 = Base64.getEncoder().encodeToString(img1);
        demo2Base64 = Base64.getEncoder().encodeToString(img2);
    }

    private HttpHeaders keyHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.set("X-API-Key", "test-key");
        return h;
    }

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
}
