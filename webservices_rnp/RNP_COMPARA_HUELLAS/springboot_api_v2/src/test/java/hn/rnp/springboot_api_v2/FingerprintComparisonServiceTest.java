package hn.rnp.springboot_api_v2;

import hn.rnp.springboot_api_v2.model.FingerprintComparisonResult;
import hn.rnp.springboot_api_v2.service.FingerprintComparisonService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.InputStream;
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
        // Use threshold=0 so the demo PNG files (low-quality synthetic images) always
        // score above the threshold when compared against themselves, letting us verify
        // the matches/resultado logic without depending on fingerprint image quality.
        ReflectionTestUtils.setField(service, "threshold", 0.0);

        InputStream stream = getClass().getResourceAsStream("/huellas/demo_1.png");
        if (stream == null) throw new IllegalStateException("demo_1.png missing from test resources");
        demo1Base64 = Base64.getEncoder().encodeToString(stream.readAllBytes());
    }

    @Test
    void compareBase64JsonSameImageBothSidesIsPositivo() {
        FingerprintComparisonResult result = service.compareBase64Json("test", demo1Base64, demo1Base64, 500);

        assertThat(result.matches()).isTrue();
        assertThat(result.resultado()).isEqualTo("Positivo");
        assertThat(result.score()).isGreaterThanOrEqualTo(0.0);
        assertThat(result.dpi()).isEqualTo(500);
        assertThat(result.threshold()).isEqualTo(0.0);
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
