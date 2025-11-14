# 500 Errors Debug Report

## Problem
Frontend was returning HTTP 500 errors with the following message:
```
Failed to proxy http://localhost:8080/api/registryList?registry=docker.io Error: socket hang up
    code: 'ECONNRESET'
```

No logs were visible in the backend, which suggested the backend wasn't receiving any requests.

## Root Cause
**The backend Rust service was not running.** The application stack consists of:
- **Backend**: Rust service with Axum framework listening on `localhost:8080`
- **Frontend**: Next.js application with HTTP rewrite rules that proxy `/api/*` requests to the backend

When the backend wasn't running:
- The frontend proxy tried to connect to `http://localhost:8080`
- Got `ECONNRESET` (connection reset) because nothing was listening
- This resulted in HTTP 500 errors on the frontend

## Solution

### 1. Start the Backend
The backend must be running before the frontend can proxy API requests to it.

```bash
# In /home/user/tessark/app/backend
cargo run
```

The backend will start on `http://localhost:8080` and show logs like:
```
INFO Starting tessark backend service
INFO Server listening on http://0.0.0.0:8080
```

### 2. Verify Backend Health
```bash
curl http://localhost:8080/health
# Should return: OK
```

### 3. Start the Frontend
In a new terminal:
```bash
# In /home/user/tessark/app/frontend
npm run dev
```

The frontend will start on `http://localhost:3000` and proxy API requests to the backend.

### Automatic Startup (Recommended)
Use the provided startup script:
```bash
bash /home/user/tessark/scripts/start-dev.sh
```

This script will:
- Check if backend is already running on port 8080
- Start the backend if needed and wait for it to be ready
- Start the frontend on port 3000
- Show you the URLs to access the services

## Architecture

### Request Flow
```
Browser/Client
    ↓
Frontend (Next.js on localhost:3000)
    ↓
Next.js Rewrite Rules (next.config.js)
    ↓
Backend (Rust on localhost:8080)
    ↓
External Services (Docker Registry, Helm repos, etc.)
```

### Frontend Proxy Configuration
File: `/home/user/tessark/app/frontend/next.config.js`

```javascript
async rewrites() {
  const API_BASE = process.env.API_BASE || 'http://localhost:8080';
  return [
    {
      source: '/api/:path*',
      destination: `${API_BASE}/api/:path*`,
    },
  ];
}
```

This configuration:
- Intercepts all requests to `/api/*` on the frontend
- Forwards them to the backend at `http://localhost:8080/api/*`
- Can be overridden with `API_BASE` environment variable

### Backend API Endpoints
- `GET /health` - Health check
- `GET /ready` - Readiness check (verifies skopeo and helm are available)
- `GET/POST /api/registryList` - List images in a registry
- `GET/POST /api/registryTags` - List tags for an image
- `GET/POST /api/pull` - Pull container images
- `GET/POST /api/pullChart` - Pull Helm charts
- `GET /api/fetchIndex` - Fetch Helm chart index

## API Testing

Once both services are running, test the API:

```bash
# Via backend (direct)
curl http://localhost:8080/api/health

# Via frontend (proxied)
curl http://localhost:3000/api/health

# Test registry endpoint (requires internet access)
curl "http://localhost:3000/api/registryList?registry=docker.io"
```

## Dependencies

### Backend Dependencies
The backend requires external tools:
- **skopeo**: For container image operations (pulled via `docker pull` or installed separately)
- **helm**: For Helm chart operations
- **ca-certificates**: For HTTPS connections

These are configured in the backend (`src/main.rs`):
```rust
let skopeo_path = env::var("SKOPEO_PATH").unwrap_or_else(|_| "skopeo".to_string());
let helm_path = env::var("HELM_PATH").unwrap_or_else(|_| "helm".to_string());
```

If running in Docker:
```dockerfile
RUN apt-get update && apt-get install -y skopeo helm curl ca-certificates
```

### Frontend Dependencies
```bash
cd /home/user/tessark/app/frontend
npm install
```

## Environment Variables

### Backend
- `PORT`: Server port (default: 8080)
- `RUST_LOG`: Log level (default: info)
- `SKOPEO_PATH`: Path to skopeo binary (default: "skopeo")
- `HELM_PATH`: Path to helm binary (default: "helm")

### Frontend
- `API_BASE`: Backend URL (default: "http://localhost:8080")
- `NODE_ENV`: Environment (development/production)

## Logs

### Backend Logs
The backend uses structured logging with Tokio tracing:
- INFO: General information (startup, requests)
- WARN: Warnings (invalid input, auth failures)
- ERROR: Errors (connection failures, command failures)
- DEBUG: Detailed debugging information (request details)

Enable debug logs:
```bash
RUST_LOG=debug cargo run
```

### Frontend Logs
Next.js logs are printed to the console:
```bash
npm run dev
```

## Common Issues

### Issue: "Failed to proxy http://localhost:8080/api/..."
**Cause**: Backend is not running
**Solution**: Start the backend with `cargo run`

### Issue: "skopeo command not found"
**Cause**: skopeo is not installed
**Solution**: Install skopeo or use Docker: `docker pull registry.redhat.io/ubi9/skopeo`

### Issue: "helm command not found"
**Cause**: helm is not installed
**Solution**: Install helm: `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash`

### Issue: "Failed to connect to registry"
**Cause**: Network access issue or invalid registry URL
**Solution**: Check network connectivity, verify registry URL, check authentication

## References
- Backend: `/home/user/tessark/app/backend/src/main.rs`
- Frontend: `/home/user/tessark/app/frontend/`
- Docker Compose: `/home/user/tessark/app/backend/docker-compose.yml`
- Helm Chart: `/home/user/tessark/charts/tessark/`
