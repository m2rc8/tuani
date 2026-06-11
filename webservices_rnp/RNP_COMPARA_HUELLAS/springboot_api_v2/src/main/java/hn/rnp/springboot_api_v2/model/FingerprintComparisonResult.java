package hn.rnp.springboot_api_v2.model;

public record FingerprintComparisonResult(
        String id,
        int dpi,
        double threshold,
        double score,
        boolean matches,
        String resultado
) {
}
