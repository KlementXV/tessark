# Workflows GitHub Actions

## Build and Push Docker Images & Helm Chart

Ce workflow automatise la construction et la publication des images Docker et du chart Helm pour Tessark.

### Déclencheurs

Le workflow s'exécute dans les cas suivants :
- **Push sur main** : Build et push des images et chart avec le tag `latest`
- **Push d'un tag** (ex: `v1.0.0`) : Build et push avec versioning sémantique
- **Pull Request** : Build seulement (sans push) pour validation
- **Déclenchement manuel** : Via l'interface GitHub Actions

### Artefacts produits

Le workflow génère trois artefacts publiés sur GitHub Container Registry :

#### 1. Backend (Rust)
**Image** : `ghcr.io/<owner>/<repo>-backend`
- Application API Helmer
- Base : Debian Bookworm Slim
- Inclut Skopeo pour la gestion des images

#### 2. Frontend (Next.js)
**Image** : `ghcr.io/<owner>/<repo>-frontend`
- Application web Tessark
- Base : Node 20 Alpine
- Production-ready

#### 3. Helm Chart
**Chart** : `oci://ghcr.io/<owner>/helm-charts/tessark`
- Chart Kubernetes complet
- Inclut les déploiements frontend et backend
- Support Traefik IngressRoute
- Versionné selon `charts/tessark/Chart.yaml`

### Tags générés

Les images sont taggées automatiquement selon le contexte :
- `latest` : dernière version de la branche main
- `main-<sha>` : commit spécifique sur main
- `v1.2.3` : version sémantique (si tag git)
- `1.2` : version majeure.mineure (si tag git)
- `pr-<number>` : pull request (build uniquement)

### Tests locaux avec gh act

Vous pouvez tester le workflow localement avant de pousser sur GitHub :

#### Prérequis
```bash
# Installer l'extension gh act
gh extension install https://github.com/nektos/gh-act
```

#### Commandes de test

```bash
# Lister les workflows disponibles
gh act --list

# Test en mode dry-run (simulation)
gh act pull_request -n

# Tester le build du frontend (sans push)
gh act pull_request -j build-frontend

# Tester le build du backend (sans push)
gh act pull_request -j build-backend

# Tester le packaging du chart Helm
gh act pull_request -j package-helm-chart

# Tester tous les jobs en parallèle
gh act pull_request

# Mode verbeux pour debug
gh act pull_request --verbose

# Simuler un push sur main
gh act push --verbose
```

#### Configuration act

Le fichier `~/.config/act/actrc` permet de configurer act :
```bash
# Image Medium (recommandée) - ~500MB
-P ubuntu-latest=catthehacker/ubuntu:act-latest
```

### Cache GitHub Actions

Le workflow utilise le cache GitHub Actions pour :
- Accélérer les builds des dépendances Rust (cargo-chef)
- Réutiliser les layers Docker entre builds
- Mode : `type=gha,mode=max` pour un cache optimal

### Sécurité

- Les images sont buildées avec des utilisateurs non-root
- Utilisation de `GITHUB_TOKEN` pour l'authentification (automatique)
- Pas de secrets requis pour le build de base
- Permissions minimales : `contents: read`, `packages: write`

### Plateformes

Actuellement configuré pour : `linux/amd64`

Pour ajouter le support ARM (ex: Apple Silicon) :
```yaml
platforms: linux/amd64,linux/arm64
```

### Utilisation des artefacts

#### Images Docker

```bash
# Pull de l'image backend
docker pull ghcr.io/<owner>/<repo>-backend:latest

# Pull de l'image frontend
docker pull ghcr.io/<owner>/<repo>-frontend:latest

# Run avec docker-compose
docker-compose -f app/backend/docker-compose.yml up
```

#### Chart Helm

```bash
# Installer le chart depuis GHCR
helm install tessark oci://ghcr.io/<owner>/helm-charts/tessark --version 0.1.0

# Mettre à jour une installation existante
helm upgrade tessark oci://ghcr.io/<owner>/helm-charts/tessark --version 0.1.0

# Avec des valeurs personnalisées
helm install tessark oci://ghcr.io/<owner>/helm-charts/tessark \
  --version 0.1.0 \
  --set frontend.image.tag=main-abc123 \
  --set backend.image.tag=main-abc123

# Lister les versions disponibles
helm search repo tessark --versions

# Pull du chart localement
helm pull oci://ghcr.io/<owner>/helm-charts/tessark --version 0.1.0
```

### Debugging

En cas d'erreur de build :

1. Tester localement avec `gh act`
2. Vérifier les logs dans l'onglet Actions de GitHub
3. Vérifier que les Dockerfiles fonctionnent :
   ```bash
   cd app/backend && docker build .
   cd app/frontend && docker build .
   ```
4. Vérifier que le chart Helm est valide :
   ```bash
   helm lint charts/tessark
   helm template tessark charts/tessark
   helm package charts/tessark
   ```
5. Vérifier les permissions du repository (Settings > Actions > General)

### Personnalisation

Pour utiliser Docker Hub au lieu de GHCR, modifier :
```yaml
env:
  REGISTRY: docker.io
  IMAGE_PREFIX: <votre-username>
```

Et ajouter les secrets :
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
