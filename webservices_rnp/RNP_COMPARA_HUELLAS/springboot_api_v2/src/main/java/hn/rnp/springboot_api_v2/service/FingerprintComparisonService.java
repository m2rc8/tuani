package hn.rnp.springboot_api_v2.service;

import com.machinezoo.sourceafis.FingerprintImage;
import com.machinezoo.sourceafis.FingerprintImageOptions;
import com.machinezoo.sourceafis.FingerprintMatcher;
import com.machinezoo.sourceafis.FingerprintTemplate;
import hn.rnp.springboot_api_v2.model.FingerprintComparisonResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Base64;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class FingerprintComparisonService {

    @Value("${app.fingerprint.base-path}")
    private String basePath;

    @Value("${app.fingerprint.threshold:40}")
    private double threshold;

    public String compareByIdAndDpi(String id, int dpi) throws IOException {
        FingerprintComparisonResult result = compareByIdAndDpiJson(id, dpi);
        return toLegacyResponse(result);
    }

    public FingerprintComparisonResult compareByIdAndDpiJson(String id, int dpi) throws IOException {
        Path firstFingerprint = Path.of(basePath, id + "_1.png");
        Path secondFingerprint = Path.of(basePath, id + "_2.png");
        return compareInternal(id, firstFingerprint, secondFingerprint, dpi);
    }

    public String compareInSubfolderB(String id) throws IOException {
        FingerprintComparisonResult result = compareInSubfolderBJson(id);
        return toLegacyResponse(result);
    }

    public FingerprintComparisonResult compareInSubfolderBJson(String id) throws IOException {
        Path firstFingerprint = Path.of(basePath, "b", id + "_1.png");
        Path secondFingerprint = Path.of(basePath, "b", id + "_2.png");
        return compareInternal(id, firstFingerprint, secondFingerprint, 500);
    }

    public FingerprintComparisonResult compareBase64Json(String id, String huella1Base64, String huella2Base64, Integer dpi) {
        if (huella1Base64 == null || huella1Base64.isBlank()) {
            throw new IllegalArgumentException("huella1 is required");
        }
        if (huella2Base64 == null || huella2Base64.isBlank()) {
            throw new IllegalArgumentException("huella2 is required");
        }

        int resolvedDpi = (dpi == null || dpi <= 0) ? 500 : dpi;
        String resolvedId = (id == null || id.isBlank()) ? "request" : id;

        byte[] firstBytes = decodeBase64Image(huella1Base64);
        byte[] secondBytes = decodeBase64Image(huella2Base64);

        FingerprintTemplate probe = new FingerprintTemplate(
                new FingerprintImage(
                        firstBytes,
                        new FingerprintImageOptions().dpi(resolvedDpi)));

        FingerprintTemplate candidate = new FingerprintTemplate(
                new FingerprintImage(
                        secondBytes,
                        new FingerprintImageOptions().dpi(resolvedDpi)));

        double score = new FingerprintMatcher(probe).match(candidate);
        boolean matches = score >= threshold;
        String resultado = matches ? "Positivo" : "Negativo";

        return new FingerprintComparisonResult(resolvedId, resolvedDpi, threshold, score, matches, resultado);
    }

    private FingerprintComparisonResult compareInternal(String id, Path firstFingerprint, Path secondFingerprint, int dpi) throws IOException {
        FingerprintTemplate probe = new FingerprintTemplate(
                new FingerprintImage(
                        Files.readAllBytes(firstFingerprint),
                        new FingerprintImageOptions().dpi(dpi)));

        FingerprintTemplate candidate = new FingerprintTemplate(
                new FingerprintImage(
                        Files.readAllBytes(secondFingerprint),
                        new FingerprintImageOptions().dpi(dpi)));

        double score = new FingerprintMatcher(probe).match(candidate);
        boolean matches = score >= threshold;
        String resultado = matches ? "Positivo" : "Negativo";

        return new FingerprintComparisonResult(id, dpi, threshold, score, matches, resultado);
    }

    private String toLegacyResponse(FingerprintComparisonResult result) {
        return "huella " + result.id() + " --" + result.resultado() + " ||" + result.score();
    }

    private byte[] decodeBase64Image(String base64Value) {
        String value = base64Value;
        int commaIndex = value.indexOf(',');
        if (value.startsWith("data:image") && commaIndex > -1 && commaIndex < value.length() - 1) {
            value = value.substring(commaIndex + 1);
        }

        try {
            return Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid base64 fingerprint payload", ex);
        }
    }
}
