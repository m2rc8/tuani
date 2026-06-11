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
