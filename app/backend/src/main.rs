use axum::{
    body::Body,
    extract::Query,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use regex::Regex;
use serde::Deserialize;
use std::{env, path::PathBuf, time::Duration};
use tokio::{fs, process::Command, time::timeout};
use tokio_util::io::ReaderStream;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    skopeo_path: String,
    client: reqwest::Client,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    eprintln!("Starting helmer-api...");
    let skopeo_path = env::var("SKOPEO_PATH").unwrap_or_else(|_| "skopeo".to_string());
    eprintln!("Skopeo path: {}", skopeo_path);
    let client = reqwest::Client::builder()
        .user_agent("helmer-api/0.1")
        .build()?;
    eprintln!("HTTP client created");

    let state = AppState { skopeo_path, client };

    let app = Router::new()
        .route("/api/fetchIndex", get(fetch_index))
        .route("/api/pull", get(pull_image))
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .with_state(state);

    let port = env::var("PORT").unwrap_or_else(|_| "8080".into()).parse::<u16>()?;
    eprintln!("Parsed port: {}", port);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    eprintln!("Binding to {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("listening on http://{}", addr);
    axum::serve(listener, app).await?;
    eprintln!("Server stopped");
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
    // Validate URL: only http/https
    let Ok(mut url) = url::Url::parse(&params.url) else {
        return (StatusCode::BAD_REQUEST, "Invalid URL").into_response();
    };
    match url.scheme() {
        "http" | "https" => {}
        _ => return (StatusCode::BAD_REQUEST, "Invalid scheme").into_response(),
    }
    // Normalize to index.yaml if not present
    let path = url.path().to_string();
    if !path.ends_with("/index.yaml") && !path.ends_with("/index.yml") {
        let mut p = path.trim_end_matches('/').to_string();
        p.push_str("/index.yaml");
        url.set_path(&p);
    }

    let res = state.client.get(url.clone()).send().await;
    let Ok(resp) = res else {
        return (StatusCode::BAD_GATEWAY, "Upstream fetch failed").into_response();
    };
    if !resp.status().is_success() {
        return (
            StatusCode::BAD_GATEWAY,
            format!("Upstream error: {}", resp.status()),
        )
            .into_response();
    }
    let text = resp.text().await.unwrap_or_default();
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    (StatusCode::OK, headers, text).into_response()
}

#[derive(Deserialize)]
struct PullParams {
    r#ref: String,
    #[serde(default = "default_format")]
    format: String,
}

fn default_format() -> String {
    "docker-archive".to_string()
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

async fn pull_image(
    axum::extract::State(state): axum::extract::State<AppState>,
    Query(params): Query<PullParams>,
) -> impl IntoResponse {
    if params.r#ref.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing ref").into_response();
    }
    if !valid_ref(&params.r#ref) {
        return (StatusCode::BAD_REQUEST, "Invalid ref").into_response();
    }

    let fmt = match params.format.as_str() {
        "docker-archive" | "oci-archive" => params.format.clone(),
        _ => "docker-archive".to_string(),
    };

    let uid = Uuid::new_v4().to_string();
    let tmp: PathBuf = std::env::temp_dir().join(format!("image-{}.tar", uid));

    let (repo, tag) = parse_repo_tag(&params.r#ref);
    let dest = if fmt == "docker-archive" {
        format!("{}:{}:{}:{}", fmt, tmp.display(), repo, tag)
    } else {
        format!("{}:{}", fmt, tmp.display())
    };

    let mut cmd = Command::new(&state.skopeo_path);
    cmd.arg("copy").arg(format!("docker://{}", params.r#ref)).arg(dest);

    let result = timeout(Duration::from_secs(300), cmd.output()).await;
    let output = match result {
        Err(_) => return (StatusCode::GATEWAY_TIMEOUT, "Timeout while copying image").into_response(),
        Ok(Err(e)) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                return (StatusCode::NOT_IMPLEMENTED, "skopeo not found (ENOENT)").into_response();
            }
            return (
                StatusCode::BAD_GATEWAY,
                format!("Failed to spawn skopeo: {}", e),
            )
                .into_response();
        }
        Ok(Ok(out)) => out,
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
        if stderr.contains("manifest unknown")
            || stderr.contains("not found")
            || stderr.contains("name unknown")
        {
            return (StatusCode::NOT_FOUND, "Image not found").into_response();
        }
        if stderr.contains("denied")
            || stderr.contains("unauthorized")
            || stderr.contains("authentication required")
        {
            return (StatusCode::FORBIDDEN, "Access denied to registry").into_response();
        }
        return (
            StatusCode::BAD_GATEWAY,
            format!("skopeo error: {}", String::from_utf8_lossy(&output.stderr)),
        )
            .into_response();
    }

    // Get file size for Content-Length header
    let file_size = match fs::metadata(&tmp).await {
        Ok(meta) => meta.len(),
        Err(e) => {
            let _ = fs::remove_file(&tmp).await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get file metadata: {}", e),
            )
                .into_response();
        }
    };

    // Open file for streaming
    let file = match fs::File::open(&tmp).await {
        Ok(f) => f,
        Err(e) => {
            let _ = fs::remove_file(&tmp).await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to open archive: {}", e),
            )
                .into_response();
        }
    };

    // Create a stream from the file reader
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Schedule file deletion after a delay to allow streaming to complete
    let tmp_clone = tmp.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let _ = fs::remove_file(&tmp_clone).await;
    });

    let filename = format!("{}-{}-{}.tar", repo, tag, fmt);
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/x-tar"),
    );
    headers.insert(
        axum::http::header::CONTENT_LENGTH,
        HeaderValue::from_str(&file_size.to_string()).unwrap_or(HeaderValue::from_static("0")),
    );
    headers.insert(
        axum::http::header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)).unwrap_or(HeaderValue::from_static("attachment")),
    );
    headers.insert(axum::http::header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    (StatusCode::OK, headers, body).into_response()
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn readiness_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    let mut cmd = Command::new(&state.skopeo_path);
    cmd.arg("--version");
    
    match timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(output)) if output.status.success() => {
            (StatusCode::OK, "Ready")
        },
        _ => {
            (StatusCode::SERVICE_UNAVAILABLE, "skopeo not available")
        }
    }
}

