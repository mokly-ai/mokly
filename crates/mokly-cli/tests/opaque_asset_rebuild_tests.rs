//! A stale asset request regenerates Serve even when filesystem watching is disabled.

#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;

#[tokio::test]
async fn digest_mismatch_requests_a_new_generation_without_a_watch_event() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("css")).unwrap();
    fs::write(
        root.path().join("mokly.config.json"),
        r#"{"stylesheets":[{"match":"**","stylesheets":["css/main.css"]}]}"#,
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    fs::write(
        root.path().join("css/main.css"),
        ".image{background:url('./image.svg')}",
    )
    .unwrap();
    let asset = root.path().join("css/image.svg");
    fs::write(&asset, "before").unwrap();
    let viewer = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/viewer/dist")
        .canonicalize()
        .unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--no-watch", "--port", "0"])
        .current_dir(root.path())
        .env("PATH", "")
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_VIEWER_DIST", viewer)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();
    let url = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let line = lines
                .next_line()
                .await
                .unwrap()
                .expect("Serve startup output");
            if let Some(url) = line.strip_prefix("Mokly listening at ") {
                break url.to_owned();
            }
        }
    })
    .await
    .unwrap();
    let host = url.strip_prefix("http://").unwrap();
    let first: Value =
        serde_json::from_str(&get(host, "/mokly-viewer/index.json").await.1).unwrap();
    let resource = "/static/mokly-generated/assets/css/image.svg";
    assert_eq!(get(host, resource).await, (200, "before".into()));
    fs::write(asset, "edited").unwrap();
    assert_eq!(get(host, resource).await.0, 500);
    let next = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let index: Value =
                serde_json::from_str(&get(host, "/mokly-viewer/index.json").await.1).unwrap();
            if index["live"]["generation"] != first["live"]["generation"] {
                break index;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert!(next["revision"].as_u64().unwrap() > first["revision"].as_u64().unwrap());
    assert_eq!(get(host, resource).await, (200, "edited".into()));
    let status = Command::new("kill")
        .args(["-INT", &child.id().unwrap().to_string()])
        .status()
        .await
        .unwrap();
    assert!(status.success());
    let status = tokio::time::timeout(Duration::from_secs(15), child.wait())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(status.code(), Some(0));
}

async fn get(host: &str, path: &str) -> (u16, String) {
    let mut socket = TcpStream::connect(host).await.unwrap();
    socket
        .write_all(
            format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .await
        .unwrap();
    let mut response = String::new();
    socket.read_to_string(&mut response).await.unwrap();
    let (headers, body) = response.split_once("\r\n\r\n").unwrap();
    let status = headers.split_whitespace().nth(1).unwrap().parse().unwrap();
    (status, body.into())
}
