use axum::{
    body::Body,
    extract::{Query, Json},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use regex::Regex;
use serde::Deserialize;
use std::{env, time::Duration};
use tokio::{fs, process::Command, time::timeout};
use tokio_util::io::ReaderStream;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    skopeo_path: String,
    helm_path: String,
    client: reqwest::Client,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    info!("Starting tessark backend service");
    let skopeo_path = env::var("SKOPEO_PATH").unwrap_or_else(|_| "skopeo".to_string());
    info!("Skopeo path: {}", skopeo_path);
    let helm_path = env::var("HELM_PATH").unwrap_or_else(|_| "helm".to_string());
    info!("Helm path: {}", helm_path);
    let client = reqwest::Client::builder()
        .user_agent("tessark-backend/0.1")
        .build()?;
    info!("HTTP client created");

    let state = AppState { skopeo_path, helm_path, client };

    let app = Router::new()
        .route("/api/fetchIndex", get(fetch_index))
        .route("/api/pull", get(pull_image).post(pull_image_post))
        .route("/api/pullChart", get(pull_chart).post(pull_chart_post))
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .with_state(state);

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse::<u16>()?;
    info!("Parsed port: {}", port);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    info!("Binding to {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Server listening on http://{}", addr);
    axum::serve(listener, app).await?;
    info!("Server stopped");
    Ok(())
}

#[derive(Deserialize)]
struct FetchIndexParams {
    url: String,
}

async fn fetch_index(
    axum::extract::State(state): axum::extract::State<AppState>,
    Query(params): Query<FetchIndexParams>,
) -> impl IntoResponse {
    debug!("Fetching index from: {}", params.url);

    // Validate URL: only http/https
    let Ok(mut url) = url::Url::parse(&params.url) else {
        warn!("Invalid URL format: {}", params.url);
        return (StatusCode::BAD_REQUEST, "Invalid URL format").into_response();
    };
    match url.scheme() {
        "http" | "https" => {}
        _ => {
            warn!("Invalid URL scheme: {}", url.scheme());
            return (StatusCode::BAD_REQUEST, "Invalid URL scheme").into_response();
        }
    }

    // Normalize to index.yaml if not present
    let path = url.path().to_string();
    if !path.ends_with("/index.yaml") && !path.ends_with("/index.yml") {
        let mut p = path.trim_end_matches('/').to_string();
        p.push_str("/index.yaml");
        url.set_path(&p);
    }

    debug!("Final index URL: {}", url);

    // Fetch with timeout
    let fetch_future = state.client.get(url.clone()).send();
    let res = match timeout(Duration::from_secs(30), fetch_future).await {
        Ok(result) => result,
        Err(_) => {
            error!("Timeout fetching index from: {}", url);
            return (StatusCode::GATEWAY_TIMEOUT, "Upstream request timeout")
                .into_response();
        }
    };

    let Ok(resp) = res else {
        error!("Failed to fetch index from: {}", url);
        return (StatusCode::BAD_GATEWAY, "Upstream fetch failed").into_response();
    };

    if !resp.status().is_success() {
        warn!("Upstream error: {} from {}", resp.status(), url);
        return (
            StatusCode::BAD_GATEWAY,
            format!("Upstream error: {}", resp.status()),
        )
            .into_response();
    }

    match resp.text().await {
        Ok(text) => {
            debug!("Successfully fetched index ({} bytes)", text.len());
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            );
            (StatusCode::OK, headers, text).into_response()
        }
        Err(e) => {
            error!("Failed to read response body: {}", e);
            (StatusCode::BAD_GATEWAY, "Failed to read upstream response").into_response()
        }
    }
}

#[derive(Deserialize)]
struct PullParams {
    r#ref: String,
    #[serde(default = "default_format")]
    format: String,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

#[derive(Deserialize)]
struct PullRequestBody {
    r#ref: String,
    #[serde(default = "default_format")]
    format: String,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

fn default_format() -> String {
    "docker-archive".to_string()
}

#[derive(Deserialize)]
struct PullChartParams {
    r#ref: String,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

#[derive(Deserialize)]
struct PullChartRequestBody {
    r#ref: String,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

fn valid_ref(s: &str) -> bool {
    // letters, digits, slash, dot, colon, @, underscore, dash
    // same as JS: /^[A-Za-z0-9./:@_\-]+$/
    static PATTERN: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"^[A-Za-z0-9./:@_\-]+$").unwrap()
    });
    PATTERN.is_match(s)
}

fn parse_repo_tag(reference: &str) -> (String, String) {
    // Remove transport prefix if any (e.g., docker://)
    let ref_no_transport = reference
        .strip_prefix("docker://")
        .or_else(|| reference.split_once("://").map(|(_, r)| r))
        .unwrap_or(reference)
        .to_string();

    let after_registry = match ref_no_transport.find('/') {
        Some(i) => ref_no_transport[i + 1..].to_string(),
        None => ref_no_transport.clone(),
    };

    if let Some((name_part, _digest)) = after_registry.split_once('@') {
        let repo = name_part.split('/').last().unwrap_or("image").to_string();
        return (repo, "latest".to_string());
    }

    if let Some(i) = after_registry.rfind(':') {
        let name_part = &after_registry[..i];
        let tag = &after_registry[i + 1..];
        let repo = name_part.split('/').last().unwrap_or("image").to_string();
        (repo, if tag.is_empty() { "latest".into() } else { tag.into() })
    } else {
        let repo = after_registry.split('/').last().unwrap_or("image").to_string();
        (repo, "latest".into())
    }
}

// GET endpoint (backwards compatible, credentials in query params - less secure)
async fn pull_image(
    axum::extract::State(state): axum::extract::State<AppState>,
    Query(params): Query<PullParams>,
) -> impl IntoResponse {
    do_pull_image(
        state,
        params.r#ref,
        params.format,
        params.username,
        params.password,
    )
    .await
}

// POST endpoint with secure credentials in body
async fn pull_image_post(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(body): Json<PullRequestBody>,
) -> impl IntoResponse {
    do_pull_image(
        state,
        body.r#ref,
        body.format,
        body.username,
        body.password,
    )
    .await
}

// Common implementation for both GET and POST
async fn do_pull_image(
    state: AppState,
    reference: String,
    format: String,
    username: Option<String>,
    password: Option<String>,
) -> axum::response::Response {
    debug!("Pull request: ref={}, format={}", reference, format);

    // Validate reference
    if reference.trim().is_empty() {
        warn!("Empty image reference");
        return (StatusCode::BAD_REQUEST, "Missing image reference").into_response();
    }

    if !valid_ref(&reference) {
        warn!("Invalid reference format: {}", reference);
        return (StatusCode::BAD_REQUEST, "Invalid image reference format").into_response();
    }

    let fmt = match format.as_str() {
        "docker-archive" | "oci-archive" => format.clone(),
        _ => {
            debug!("Unknown format {}, defaulting to docker-archive", format);
            "docker-archive".to_string()
        }
    };

    let uid = Uuid::new_v4().to_string();
    let tmp_tar = std::env::temp_dir().join(format!("images-{}.tar", uid));
    let (repo, tag) = parse_repo_tag(&reference);
    let dest = format!("{}:{}:{}:{}", fmt, tmp_tar.display(), repo, tag);

    debug!("Temp file: {}", tmp_tar.display());

    let mut cmd = Command::new(&state.skopeo_path);
    cmd.arg("copy");

    // Add authentication if credentials are provided
    if let (Some(username), Some(password)) = (&username, &password) {
        if !username.trim().is_empty() && !password.trim().is_empty() {
            let creds = format!("{}:{}", username.trim(), password.trim());
            cmd.arg("--src-creds").arg(creds);
            debug!("Authentication credentials provided");
        }
    }

    cmd.arg(format!("docker://{}", reference)).arg(&dest);

    debug!("Executing skopeo copy for: {}", reference);
    let result = timeout(Duration::from_secs(300), cmd.output()).await;
    let output = match result {
        Err(_) => {
            error!("Timeout copying image: {}", reference);
            let _ = fs::remove_file(&tmp_tar).await;
            return (StatusCode::GATEWAY_TIMEOUT, "Image pull timeout (exceeded 5 minutes)")
                .into_response();
        }
        Ok(Err(e)) => {
            error!("Failed to spawn skopeo: {}", e);
            let _ = fs::remove_file(&tmp_tar).await;
            if e.kind() == std::io::ErrorKind::NotFound {
                return (StatusCode::NOT_IMPLEMENTED, "skopeo command not found").into_response();
            }
            return (StatusCode::BAD_GATEWAY, format!("Failed to spawn skopeo: {}", e))
                .into_response();
        }
        Ok(Ok(out)) => out,
    };

    if !output.status.success() {
        error!("skopeo copy failed for: {}", reference);
        let _ = fs::remove_file(&tmp_tar).await;
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();

        if stderr.contains("manifest unknown")
            || stderr.contains("not found")
            || stderr.contains("name unknown")
        {
            warn!("Image not found: {}", reference);
            return (StatusCode::NOT_FOUND, format!("Image not found: {}", reference))
                .into_response();
        }
        if stderr.contains("denied")
            || stderr.contains("unauthorized")
            || stderr.contains("authentication required")
        {
            warn!("Access denied for: {}", reference);
            return (StatusCode::FORBIDDEN, "Access denied to registry").into_response();
        }

        error!("skopeo stderr: {}", stderr);
        return (StatusCode::BAD_GATEWAY, "Failed to copy image").into_response();
    }

    // Get file size for Content-Length header
    let file_size = match fs::metadata(&tmp_tar).await {
        Ok(meta) => meta.len(),
        Err(e) => {
            error!("Failed to get file metadata: {}", e);
            let _ = fs::remove_file(&tmp_tar).await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to prepare download")
                .into_response();
        }
    };

    debug!("Archive size: {} bytes", file_size);

    // Open file for streaming
    let file = match fs::File::open(&tmp_tar).await {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to open archive: {}", e);
            let _ = fs::remove_file(&tmp_tar).await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to open archive")
                .into_response();
        }
    };

    // Create a stream from the file reader
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Schedule file deletion after streaming completes (with retry)
    let tmp_clone = tmp_tar.clone();
    tokio::spawn(async move {
        // Wait a bit for streaming to complete, then attempt deletion
        for retry in 0..3 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if fs::remove_file(&tmp_clone).await.is_ok() {
                debug!("Temporary file cleaned up");
                return;
            }
            if retry < 2 {
                debug!("Retry cleaning temp file (attempt {})", retry + 1);
            }
        }
        warn!("Failed to clean up temporary file: {}", tmp_clone.display());
    });

    // Generate filename
    let filename = format!("{}-{}-{}.tar", repo, tag, fmt);

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/x-tar"),
    );
    if let Ok(val) = HeaderValue::from_str(&file_size.to_string()) {
        headers.insert(axum::http::header::CONTENT_LENGTH, val);
    }
    if let Ok(val) = HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)) {
        headers.insert(axum::http::header::CONTENT_DISPOSITION, val);
    }
    headers.insert(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("no-store"),
    );

    info!("Serving image: {} ({} bytes)", reference, file_size);
    (StatusCode::OK, headers, body).into_response()
}

// GET endpoint for pulling charts (backwards compatible)
async fn pull_chart(
    axum::extract::State(state): axum::extract::State<AppState>,
    Query(params): Query<PullChartParams>,
) -> impl IntoResponse {
    do_pull_chart(
        state,
        params.r#ref,
        params.version,
        params.username,
        params.password,
    )
    .await
}

// POST endpoint for pulling charts with secure credentials
async fn pull_chart_post(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(body): Json<PullChartRequestBody>,
) -> impl IntoResponse {
    do_pull_chart(
        state,
        body.r#ref,
        body.version,
        body.username,
        body.password,
    )
    .await
}

// Common implementation for both GET and POST
async fn do_pull_chart(
    state: AppState,
    reference: String,
    version: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> axum::response::Response {
    debug!("Pull chart request: ref={}, version={:?}", reference, version);

    // Validate reference (OCI format: ghcr.io/namespace/chart-name)
    if reference.trim().is_empty() {
        warn!("Empty chart reference");
        return (StatusCode::BAD_REQUEST, "Missing chart reference").into_response();
    }

    if !valid_ref(&reference) {
        warn!("Invalid reference format: {}", reference);
        return (StatusCode::BAD_REQUEST, "Invalid chart reference format").into_response();
    }

    let uid = Uuid::new_v4().to_string();
    let temp_dir = std::env::temp_dir().join(format!("charts-{}", uid));

    // Create temporary directory
    if let Err(e) = fs::create_dir_all(&temp_dir).await {
        error!("Failed to create temp directory: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create temp directory").into_response();
    }

    // Build helm pull command
    let mut cmd = Command::new(&state.helm_path);
    cmd.arg("pull");

    // Add authentication if provided
    if let (Some(username), Some(password)) = (&username, &password) {
        if !username.trim().is_empty() && !password.trim().is_empty() {
            cmd.arg("--username").arg(username.trim());
            cmd.arg("--password").arg(password.trim());
            debug!("Authentication credentials provided for chart pull");
        }
    }

    // Add version if specified
    if let Some(ver) = &version {
        if !ver.trim().is_empty() {
            cmd.arg("--version").arg(ver.trim());
        }
    }

    // Set output directory
    cmd.arg("--destination").arg(&temp_dir);

    // Add the OCI reference with oci:// prefix
    cmd.arg(format!("oci://{}", reference));

    debug!("Executing helm pull for: {}", reference);
    let result = timeout(Duration::from_secs(300), cmd.output()).await;
    let output = match result {
        Err(_) => {
            error!("Timeout pulling chart: {}", reference);
            let _ = fs::remove_dir_all(&temp_dir).await;
            return (StatusCode::GATEWAY_TIMEOUT, "Chart pull timeout (exceeded 5 minutes)")
                .into_response();
        }
        Ok(Err(e)) => {
            error!("Failed to spawn helm: {}", e);
            let _ = fs::remove_dir_all(&temp_dir).await;
            if e.kind() == std::io::ErrorKind::NotFound {
                return (StatusCode::NOT_IMPLEMENTED, "helm command not found").into_response();
            }
            return (StatusCode::BAD_GATEWAY, format!("Failed to spawn helm: {}", e))
                .into_response();
        }
        Ok(Ok(out)) => out,
    };

    if !output.status.success() {
        error!("helm pull failed for: {}", reference);
        let _ = fs::remove_dir_all(&temp_dir).await;
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();

        if stderr.contains("not found") || stderr.contains("chart") {
            warn!("Chart not found: {}", reference);
            return (StatusCode::NOT_FOUND, format!("Chart not found: {}", reference))
                .into_response();
        }
        if stderr.contains("denied") || stderr.contains("unauthorized") {
            warn!("Access denied for: {}", reference);
            return (StatusCode::FORBIDDEN, "Access denied to registry").into_response();
        }

        error!("helm stderr: {}", stderr);
        return (StatusCode::BAD_GATEWAY, "Failed to pull chart").into_response();
    }

    // Find the .tgz file that was created
    let mut entries = match fs::read_dir(&temp_dir).await {
        Ok(e) => e,
        Err(err) => {
            error!("Failed to read temp directory: {}", err);
            let _ = fs::remove_dir_all(&temp_dir).await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read chart files").into_response();
        }
    };

    let mut chart_file = None;
    while let Ok(Some(entry)) = entries.next_entry().await {
        if let Ok(path) = entry.path().canonicalize() {
            if path.extension().map_or(false, |ext| ext == "tgz") {
                chart_file = Some(path);
                break;
            }
        }
    }

    let Some(chart_path) = chart_file else {
        error!("No .tgz file found after helm pull");
        let _ = fs::remove_dir_all(&temp_dir).await;
        return (StatusCode::INTERNAL_SERVER_ERROR, "No chart file generated").into_response();
    };

    // Get file size for Content-Length header
    let file_size = match fs::metadata(&chart_path).await {
        Ok(meta) => meta.len(),
        Err(e) => {
            error!("Failed to get file metadata: {}", e);
            let _ = fs::remove_dir_all(&temp_dir).await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to prepare download").into_response();
        }
    };

    debug!("Chart size: {} bytes", file_size);

    // Open file for streaming
    let file = match fs::File::open(&chart_path).await {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to open chart file: {}", e);
            let _ = fs::remove_dir_all(&temp_dir).await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to open chart file")
                .into_response();
        }
    };

    // Create a stream from the file reader
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Schedule directory deletion with delay to allow streaming to complete
    // Increase delay to 30 seconds to accommodate large files and slow networks
    let temp_clone = temp_dir.clone();
    tokio::spawn(async move {
        // Wait longer to ensure streaming is completely finished
        tokio::time::sleep(Duration::from_secs(30)).await;

        for retry in 0..3 {
            if fs::remove_dir_all(&temp_clone).await.is_ok() {
                debug!("Temporary chart directory cleaned up");
                return;
            }
            if retry < 2 {
                debug!("Retry cleaning temp directory (attempt {})", retry + 1);
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        }
        warn!("Failed to clean up temporary directory: {}", temp_clone.display());
    });

    // Generate filename from reference
    let chart_name = reference.split('/').last().unwrap_or("chart");
    let filename = if let Some(ver) = version {
        format!("{}-{}.tgz", chart_name, ver)
    } else {
        format!("{}.tgz", chart_name)
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/gzip"),
    );
    if let Ok(val) = HeaderValue::from_str(&file_size.to_string()) {
        headers.insert(axum::http::header::CONTENT_LENGTH, val);
    }
    if let Ok(val) = HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)) {
        headers.insert(axum::http::header::CONTENT_DISPOSITION, val);
    }
    headers.insert(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("no-store"),
    );

    info!("Serving chart: {} ({} bytes)", reference, file_size);
    (StatusCode::OK, headers, body).into_response()
}

async fn health_check() -> impl IntoResponse {
    debug!("Health check");
    (StatusCode::OK, "OK")
}

async fn readiness_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    debug!("Readiness check");

    // Check skopeo
    let mut cmd = Command::new(&state.skopeo_path);
    cmd.arg("--version");
    let skopeo_ready = match timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(output)) if output.status.success() => true,
        _ => false,
    };

    // Check helm
    let mut cmd = Command::new(&state.helm_path);
    cmd.arg("version");
    let helm_ready = match timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(output)) if output.status.success() => true,
        _ => false,
    };

    if skopeo_ready && helm_ready {
        info!("Readiness check passed");
        (StatusCode::OK, "Ready")
    } else {
        if !skopeo_ready {
            warn!("Readiness check failed: skopeo not available");
        }
        if !helm_ready {
            warn!("Readiness check failed: helm not available");
        }
        (StatusCode::SERVICE_UNAVAILABLE, "Required tools not available")
    }
}

