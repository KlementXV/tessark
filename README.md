# Tessark 🚀

<div align="center">

**Modern Full-Stack Application with Rust Backend & Next.js Frontend**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.82-orange.svg)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14-black.svg)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-326CE5.svg)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/helm-v3-0F1689.svg)](https://helm.sh/)

</div>

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Deployment](#-deployment)
- [Development](#-development)
- [CI/CD](#-cicd)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

## 🎯 About

Tessark is a production-ready, cloud-native application that combines the performance of Rust with the developer experience of Next.js. It's designed to be deployed on Kubernetes with a complete CI/CD pipeline.

### Key Technologies

- **Backend**: Rust with Axum web framework + Skopeo for container image management
- **Frontend**: Next.js 14 with React 18 and TypeScript
- **Infrastructure**: Docker, Kubernetes, Helm
- **CI/CD**: GitHub Actions with automated builds and OCI registry publishing

## ✨ Features

- 🚄 **High Performance**: Rust backend for blazing-fast API responses
- ⚡ **Modern Frontend**: Next.js with server-side rendering and React 18
- 🐳 **Container Native**: Optimized Docker images for both services
- ☸️ **Kubernetes Ready**: Complete Helm chart with production-grade configurations
- 🔒 **Secure by Default**: Non-root containers, minimal attack surface
- 📦 **OCI Registry**: Automated builds pushed to GitHub Container Registry
- 🔄 **Multi-arch Support**: Ready for linux/amd64 (arm64 available)
- 🌐 **Ingress Support**: Traefik and Nginx ingress configurations included
- 📊 **Resource Optimized**: Fine-tuned resource requests and limits

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Traefik Ingress                       │
│                   tessark.example.com                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──────────────┬──────────────────┐
                 │              │                  │
         ┌───────▼──────┐  ┌───▼────────┐  ┌─────▼────────┐
         │   Frontend   │  │  Frontend  │  │   Backend    │
         │   (Next.js)  │  │  (Next.js) │  │    (Rust)    │
         │   Port 8080  │  │ Port 8080  │  │  Port 8080   │
         └──────────────┘  └────────────┘  └──────┬───────┘
                                                   │
                                            ┌──────▼────────┐
                                            │    Skopeo     │
                                            │ Image Manager │
                                            └───────────────┘
```

### Container Images

All images are published to GitHub Container Registry:

- **Backend**: `ghcr.io/klementxv/tessark-backend:latest`
- **Frontend**: `ghcr.io/klementxv/tessark-frontend:latest`
- **Helm Chart**: `oci://ghcr.io/klementxv/helm-charts/tessark`

## 🚀 Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/KlementXV/tessark.git
cd tessark

# Start with Docker Compose
docker-compose -f app/backend/docker-compose.yml up

# Access the application
# Frontend: http://localhost:8080
# Backend API: http://localhost:8080/api
```

### Using Helm (Kubernetes)

```bash
# Install from OCI registry
helm install tessark oci://ghcr.io/klementxv/helm-charts/tessark \
  --version 0.1.0 \
  --set ingress.host=tessark.example.com

# Check deployment status
kubectl get pods -n tessark

# Access via ingress
# https://tessark.example.com
```

## 📦 Deployment

### Prerequisites

- Docker 24+ (for local development)
- Kubernetes 1.28+ (for production)
- Helm 3.12+ (for Kubernetes deployment)
- kubectl configured with cluster access

### Production Deployment

1. **Configure your domain** in `charts/tessark/values.yaml`:

```yaml
ingress:
  enabled: true
  type: traefik  # or nginx
  host: tessark.your-domain.com
  tls:
    enabled: true
    certResolver: letsencrypt
```

2. **Customize resource limits** if needed:

```yaml
backend:
  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "1000m"
```

3. **Deploy with Helm**:

```bash
helm upgrade --install tessark ./charts/tessark \
  --namespace tessark \
  --create-namespace \
  --values charts/tessark/values.yaml
```

### Using Specific Image Tags

```bash
# Deploy specific versions
helm install tessark oci://ghcr.io/klementxv/helm-charts/tessark \
  --version 0.1.0 \
  --set frontend.image.tag=main-abc123 \
  --set backend.image.tag=main-abc123
```

## 💻 Development

### Backend (Rust)

```bash
cd app/backend

# Install dependencies (if needed)
cargo build

# Run in development mode
cargo run

# Run tests
cargo test

# Build release
cargo build --release
```

### Frontend (Next.js)

```bash
cd app/frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Local Development with Docker

```bash
# Build images locally
docker build -t tessark-backend:dev app/backend
docker build -t tessark-frontend:dev app/frontend

# Run with custom tags
docker run -p 8080:8080 tessark-backend:dev
docker run -p 3000:8080 tessark-frontend:dev
```

## 🔄 CI/CD

The project includes a complete GitHub Actions workflow that automatically:

- ✅ Builds Docker images for backend and frontend
- ✅ Packages Helm chart
- ✅ Pushes all artifacts to GitHub Container Registry
- ✅ Generates semantic version tags
- ✅ Creates build artifacts for download

### Workflow Triggers

- **Push to main**: Builds and pushes with `latest` tag
- **Version tags** (`v*`): Builds and pushes with semantic versioning
- **Pull requests**: Builds for validation (no push)
- **Manual**: Via GitHub Actions UI

### Local Testing with gh-act

```bash
# Install gh act extension
gh extension install https://github.com/nektos/gh-act

# Test the workflow locally
gh act pull_request -j build-frontend
gh act pull_request -j build-backend
gh act pull_request -j package-helm-chart

# Test all jobs
gh act pull_request
```

See [.github/workflows/README.md](.github/workflows/README.md) for detailed workflow documentation.

## 📁 Project Structure

```
tessark/
├── app/
│   ├── backend/              # Rust API service
│   │   ├── src/
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── frontend/             # Next.js web application
│       ├── app/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
├── charts/
│   └── tessark/              # Helm chart
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── templates/
│       └── README.md
└── .github/
    └── workflows/
        ├── docker-build-push.yml
        └── README.md
```

## 🎨 Customization

### Backend Configuration

Environment variables can be set in the Helm chart:

```yaml
backend:
  env:
    PORT: "8080"
    RUST_LOG: "info"
    SKOPEO_PATH: "/usr/bin/skopeo"
```

### Frontend Configuration

```yaml
frontend:
  env:
    PORT: "8080"
    NODE_ENV: "production"
```

### Scaling

```yaml
backend:
  replicaCount: 3  # Scale to 3 replicas

frontend:
  replicaCount: 5  # Scale to 5 replicas
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author


- GitHub: [@KlementXV](https://github.com/KlementXV)
- Project: [Tessark](https://github.com/KlementXV/tessark)

## 🙏 Acknowledgments

- Built with [Rust](https://www.rust-lang.org/) and [Next.js](https://nextjs.org/)
- Deployed on [Kubernetes](https://kubernetes.io/)
- CI/CD powered by [GitHub Actions](https://github.com/features/actions)

---

<div align="center">
Made with ❤️
</div>
