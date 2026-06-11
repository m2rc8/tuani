package hn.rnp.springboot_api_v2.controller;

import hn.rnp.springboot_api_v2.model.Base64ComparisonRequest;
import hn.rnp.springboot_api_v2.model.FingerprintComparisonResult;
import hn.rnp.springboot_api_v2.model.LegacyValidateResponse;
import hn.rnp.springboot_api_v2.service.FingerprintComparisonService;
import hn.rnp.springboot_api_v2.service.RequestAuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.UUID;

@RestController
public class FingerprintController {

    private static final Logger logger = LoggerFactory.getLogger(FingerprintController.class);

    private final FingerprintComparisonService comparisonService;
    private final RequestAuditService requestAuditService;

    public FingerprintController(FingerprintComparisonService comparisonService, RequestAuditService requestAuditService) {
        this.comparisonService = comparisonService;
        this.requestAuditService = requestAuditService;
    }

    @GetMapping("/huella/{h1}/{dpi}")
    public String compara(@PathVariable String h1, @PathVariable int dpi) throws IOException {
        String requestId = newRequestId();
        logger.info("Request received requestId={} endpoint=/huella/{}/{}", requestId, h1, dpi);
        return comparisonService.compareByIdAndDpi(h1, dpi);
    }

    @GetMapping("/huella2/{h1}")
    public String compara2(@PathVariable String h1) throws IOException {
        String requestId = newRequestId();
        logger.info("Request received requestId={} endpoint=/huella2/{}", requestId, h1);
        return comparisonService.compareInSubfolderB(h1);
    }

    @GetMapping("/api/huella/{h1}/{dpi}")
    public FingerprintComparisonResult comparaJson(@PathVariable String h1, @PathVariable int dpi) throws IOException {
        String requestId = newRequestId();
        logger.info("Request received requestId={} endpoint=/api/huella/{}/{}", requestId, h1, dpi);
        FingerprintComparisonResult result = comparisonService.compareByIdAndDpiJson(h1, dpi);
        logger.info("Request success requestId={} endpoint=/api/huella/{}/{} type={} score={}", requestId, h1, dpi, result.resultado(), result.score());
        return result;
    }

    @GetMapping("/api/huella2/{h1}")
    public FingerprintComparisonResult compara2Json(@PathVariable String h1) throws IOException {
        String requestId = newRequestId();
        logger.info("Request received requestId={} endpoint=/api/huella2/{}", requestId, h1);
        FingerprintComparisonResult result = comparisonService.compareInSubfolderBJson(h1);
        logger.info("Request success requestId={} endpoint=/api/huella2/{} type={} score={}", requestId, h1, result.resultado(), result.score());
        return result;
    }

    @PostMapping("/api/compare/base64")
    public ResponseEntity<?> compareBase64(@RequestBody Base64ComparisonRequest request) {
        String requestId = newRequestId();
        logger.info("Request received requestId={} endpoint=/api/compare/base64 id={} dpi={}", requestId, request.id(), request.dpi());
        try {
            FingerprintComparisonResult result = comparisonService.compareBase64Json(
                    request.id(),
                    request.huella1(),
                    request.huella2(),
                    request.dpi());
            logger.info("Request success requestId={} endpoint=/api/compare/base64 id={} type={} score={}", requestId, result.id(), result.resultado(), result.score());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            logger.warn("Request validation failed requestId={} endpoint=/api/compare/base64 message={}", requestId, ex.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            logger.error("Request failed requestId={} endpoint=/api/compare/base64", requestId, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Internal server error");
        }
    }

    @GetMapping("/ValidateFinger/validate_fingerprint")
    public LegacyValidateResponse validateFingerprintLegacyGet(
            @RequestParam String huella1,
            @RequestParam String huella2,
            @RequestParam(name = "user_rnp_access", required = false) String userRnpAccess,
            @RequestParam(name = "user_cont_access", required = false) String userContAccess,
            @RequestParam(name = "user_app_access", required = false) String userAppAccess,
            @RequestParam(name = "dpi", required = false) Integer dpi,
            HttpServletRequest request) {

        return handleLegacyRequest(huella1, huella2, userRnpAccess, userContAccess, userAppAccess, dpi, request, "GET /ValidateFinger/validate_fingerprint");
    }

    @PostMapping(value = "/ValidateFinger/validate_fingerprint", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public LegacyValidateResponse validateFingerprintLegacyPost(
            @RequestBody MultiValueMap<String, String> formData,
            HttpServletRequest request) {

        String huella1 = formData.getFirst("huella1");
        String huella2 = formData.getFirst("huella2");
        String userRnpAccess = formData.getFirst("user_rnp_access");
        String userContAccess = formData.getFirst("user_cont_access");
        String userAppAccess = formData.getFirst("user_app_access");
        Integer dpi = null;
        String dpiText = formData.getFirst("dpi");
        if (dpiText != null && !dpiText.isBlank()) {
            try {
                dpi = Integer.parseInt(dpiText);
            } catch (NumberFormatException ignored) {
                dpi = null;
            }
        }

        return handleLegacyRequest(huella1, huella2, userRnpAccess, userContAccess, userAppAccess, dpi, request, "POST /ValidateFinger/validate_fingerprint");
    }

    private LegacyValidateResponse handleLegacyRequest(
            String huella1,
            String huella2,
            String userRnpAccess,
            String userContAccess,
            String userAppAccess,
            Integer dpi,
            HttpServletRequest request,
            String endpoint) {

        String requestId = newRequestId();

        logger.info("Request received requestId={} endpoint={} caller={} dpi={}", requestId, endpoint, resolveCaller(userRnpAccess), dpi);

        try {
            FingerprintComparisonResult result = comparisonService.compareBase64Json(
                    "legacy-request",
                    huella1,
                    huella2,
                    dpi);

            String resp = result.matches() ? "si" : "no";
            LegacyValidateResponse response = new LegacyValidateResponse(result.resultado(), resp, String.valueOf(result.score()));
            requestAuditService.audit(
                    requestId,
                    endpoint,
                    resolveRequesterIp(request),
                    resolveCaller(userRnpAccess),
                    response.type(),
                    response.scor(),
                    "dpi=" + result.dpi());
                logger.info("Request success requestId={} endpoint={} caller={} type={} score={}", requestId, endpoint, resolveCaller(userRnpAccess), response.type(), response.scor());
            return response;
        } catch (Exception ex) {
            LegacyValidateResponse response = new LegacyValidateResponse("error", "no", "0");
            requestAuditService.audit(
                    requestId,
                    endpoint,
                    resolveRequesterIp(request),
                    resolveCaller(userRnpAccess),
                    response.type(),
                    response.scor(),
                    "exception=" + ex.getClass().getSimpleName());
                logger.error("Request failed requestId={} endpoint={} caller={}", requestId, endpoint, resolveCaller(userRnpAccess), ex);
            return response;
        }
    }

            private String newRequestId() {
            return UUID.randomUUID().toString();
            }

    private String resolveRequesterIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] parts = forwardedFor.split(",");
            if (parts.length > 0) {
                return parts[0].trim();
            }
        }
        return request.getRemoteAddr();
    }

    private String resolveCaller(String userRnpAccess) {
        if (userRnpAccess == null || userRnpAccess.isBlank()) {
            return "anonymous";
        }
        return userRnpAccess.trim();
    }
}
