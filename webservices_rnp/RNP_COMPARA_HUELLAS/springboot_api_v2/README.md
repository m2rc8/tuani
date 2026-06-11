# springboot_api_v2

Spring Boot REST API for fingerprint comparison using SourceAFIS. Supports file-based and base64 comparison, with API key authentication and per-IP rate limiting.

## Authentication

All endpoints require header `X-API-Key` with the configured key. Except `/actuator/health` and `/actuator/info` (public).

```
X-API-Key: <your-api-key>
```

Missing or wrong key → `401 Unauthorized`:
```json
{"error": "Unauthorized", "message": "Missing or invalid X-API-Key header"}
```

## Rate Limiting

Per-IP token bucket. Default: 100 requests burst, 50 refill/sec.

Exceeded → `429 Too Many Requests`:
```json
{"error": "Too Many Requests", "message": "Rate limit exceeded. Try again later."}
```

Response headers on every request:
```
X-Rate-Limit-Remaining: 47
X-Rate-Limit-Retry-After-Seconds: 1   (only on 429)
```

## Endpoints

- `GET /huella/{h1}/{dpi}` — reads `<basePath>/<h1>_1.png` + `<h1>_2.png`, returns plain text
- `GET /huella2/{h1}` — reads `<basePath>/b/<h1>_1.png` + `<h1>_2.png`, fixed `dpi=500`, returns plain text
- `GET /api/huella/{h1}/{dpi}` — same as above, JSON response
- `GET /api/huella2/{h1}` — same as above, JSON response
- `POST /api/compare/base64` — send fingerprints as base64, JSON response
- `POST /ValidateFinger/validate_fingerprint` — legacy-compatible, form-urlencoded

> **Note:** `GET /ValidateFinger/validate_fingerprint` was removed — sending biometric data as query params is unsafe (logged by proxies/nginx).

Response format (plain text endpoints):

```
huella {id} --Positivo ||{score}
```

JSON response example:

```json
{
  "id": "demo",
  "dpi": 500,
  "threshold": 40.0,
  "score": 52.33,
  "matches": true,
  "resultado": "Positivo"
}
```

## Configuration

`src/main/resources/application.properties`:

| Property | Env var | Default |
|---|---|---|
| `server.port` | — | `8080` |
| `app.fingerprint.base-path` | `HUELLA_BASE_PATH` | `{cwd}/springboot_api_v2/data/huellas` |
| `app.fingerprint.threshold` | — | `40` |
| `app.security.api-key` | `API_KEY` | `dev-key-insecure` |
| `app.rate-limit.capacity` | — | `100` |
| `app.rate-limit.refill-per-second` | — | `50` |
| `app.audit.file-path` | `AUDIT_FILE_PATH` | `{cwd}/springboot_api_v2/logs/requests-audit.log` |

## Run locally

```powershell
$env:API_KEY = "my-secret-key"
$env:HUELLA_BASE_PATH = "C:\temp\huellas"
.\gradlew.bat -p .\springboot_api_v2 bootRun
```

## Postman test (file-based)

1. `GET http://localhost:8080/api/huella/demo/500`
2. Header: `X-API-Key: my-secret-key`

Requirements:
- `${HUELLA_BASE_PATH}/demo_1.png`
- `${HUELLA_BASE_PATH}/demo_2.png`

## Postman test (base64)

1. `POST http://localhost:8080/api/compare/base64`
2. Header: `X-API-Key: my-secret-key`
3. Header: `Content-Type: application/json`
4. Body:

```json
{
  "id": "postman-test",
  "dpi": 500,
  "huella1": "<BASE64_FINGERPRINT_1>",
  "huella2": "<BASE64_FINGERPRINT_2>"
}
```

`huella1` and `huella2` required. `dpi` optional (default `500`). Accepts `data:image/png;base64,...` format.

## Legacy-compatible endpoint

`POST /ValidateFinger/validate_fingerprint` — `application/x-www-form-urlencoded`

Fields: `huella1`, `huella2`, `dpi` (optional), `user_rnp_access` (logged as caller), `user_cont_access`, `user_app_access`.

Response:
```json
{"type": "Positivo", "resp": "si", "scor": "571.25458558"}
```

## Audit file

Every legacy request appended as JSON Lines to the audit log.

Default path: `springboot_api_v2/logs/requests-audit.log`

Example line:
```json
{"timestamp":"2026-05-06T10:22:11.123-06:00","requestId":"5e61c9ec-...","endpoint":"POST /ValidateFinger/validate_fingerprint","ip":"127.0.0.1","caller":"anonymous","type":"Positivo","score":"571.25458558","details":"dpi=500"}
```

## Docker (production — Docker Compose)

Requires `springboot_api_v2/certs/cert.pem` and `key.pem` for TLS.

Build JAR:
```powershell
.\gradlew.bat -p .\springboot_api_v2 bootJar
```

Start stack (API + nginx with TLS):
```powershell
cd springboot_api_v2
$env:API_KEY = "my-secret-key"
docker compose up -d
```

- API available at `https://localhost` (nginx handles TLS → proxies to port 8080)
- Fingerprint images: `springboot_api_v2/data/huellas/`
- Audit log: `springboot_api_v2/data/logs/requests-audit.log`
- Both volumes persist across container restarts

Stop:
```powershell
docker compose down
```

## Docker (standalone, no nginx)

Build image:
```powershell
docker build -t fingerprint-api:1.0 .\springboot_api_v2
```

Run:
```powershell
docker run --rm -p 8080:8080 `
  -e API_KEY="my-secret-key" `
  -e HUELLA_BASE_PATH="/data/huellas" `
  -e AUDIT_FILE_PATH="/data/logs/requests-audit.log" `
  -v ${PWD}\springboot_api_v2\data:/data `
  --name fingerprint-api fingerprint-api:1.0
```

## Push image to OCI Container Registry (OCIR)

### 1) Prerequisites

- OCI tenancy with Container Registry permissions
- Docker Desktop installed
- OCI auth token (OCI Console → User Settings → Auth tokens)

### 2) Define OCIR values

```powershell
$RegionKey = "iad"
$OcIrHost = "$RegionKey.ocir.io"
$TenancyNamespace = "<your-tenancy-namespace>"
$OciUsername = "<your-oci-username>"
$RepoName = "fingerprint-api"
$ImageTag = "1.0.0"
$LocalImage = "fingerprint-api:1.0"
$RemoteImage = "$OcIrHost/$TenancyNamespace/$RepoName:$ImageTag"
```

### 3) Login, tag and push

```powershell
docker login $OcIrHost -u "$TenancyNamespace/$OciUsername"
docker tag $LocalImage $RemoteImage
docker push $RemoteImage
```

### 4) Verify

OCI Console → Developer Services → Container Registry → Repositories
