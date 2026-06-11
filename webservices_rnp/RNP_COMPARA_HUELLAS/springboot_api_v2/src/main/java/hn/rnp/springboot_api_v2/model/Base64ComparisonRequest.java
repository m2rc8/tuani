package hn.rnp.springboot_api_v2.model;

public record Base64ComparisonRequest(
        String huella1,
        String huella2,
        Integer dpi,
        String id
) {
}
