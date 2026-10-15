//! Real file changes publish fenced states and failed candidates keep the last good graph.

#![cfg(unix)]

use std::fs;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio::sync::Notify;

async fn get(host: &str, path: &str) -> String {
    let mut socket = TcpStream::connect(host).await.unwrap();
    socket
        .write_all(
            format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .await
        .unwrap();
    let mut text = String::new();
    socket.read_to_string(&mut text).await.unwrap();
    assert!(text.starts_with("HTTP/1.1 200"), "{text}");
    text.split_once("\r\n\r\n").unwrap().1.into()
}
async fn index(host: &str) -> Value {
    serde_json::from_str(&get(host, "/mokly-viewer/index.json").await).unwrap()
}

async fn ready(host: &str, previous: u64, text: &str) -> Value {
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let index = index(host).await;
            let detail: Value =
                serde_json::from_str(&get(host, "/mokly-viewer/entries/home.json").await).unwrap();
            if index["revision"].as_u64().unwrap() > previous
                && detail["revision"] == index["revision"]
                && detail["workspace"].is_object()
                && get(host, "/static/mokly-generated/home/index.mobile.html")
                    .await
                    .contains(text)
            {
                return index;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap()
}

#[tokio::test]
async fn watched_html_css_membership_config_and_failure_recovery_share_one_port() {
    let root = tempfile::tempdir().unwrap();
    for (path, bytes) in [
        (
            "mokly.config.json",
            r#"{"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        ),
        ("theme.css", "h1 { color: red }"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>First</h1>",
        ),
        (
            "viewer/browser.manifest.json",
            r#"{"schemaVersion":1,"modules":["shell.js","inspector.js"]}"#,
        ),
        ("viewer/browser/shell.js", ""),
        ("viewer/browser/inspector.js", ""),
        ("viewer/shell.css", ""),
        ("viewer/assets/fonts/InterVariable.woff2", ""),
    ] {
        let path = root.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--port", "0", "--debug-timings"])
        .current_dir(root.path())
        .env("MOKLY_VIEWER_DIST", root.path().join("viewer"))
        .env("PATH", "")
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_SIDECARS")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let lines = Arc::new(Mutex::new(Vec::new()));
    let changed = Arc::new(Notify::new());
    let logs = tokio::spawn({
        let lines = lines.clone();
        let changed = changed.clone();
        let stderr = child.stderr.take().unwrap();
        async move {
            let mut stderr = BufReader::new(stderr).lines();
            while let Some(line) = stderr.next_line().await.unwrap() {
                lines.lock().unwrap().push(line);
                changed.notify_one();
            }
        }
    });
    let mut stdout = BufReader::new(child.stdout.take().unwrap()).lines();
    let listening = tokio::time::timeout(Duration::from_secs(20), stdout.next_line())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert!(listening.ends_with(" (watching)"), "{listening}");
    let host = listening
        .split_whitespace()
        .nth(3)
        .unwrap()
        .strip_prefix("http://")
        .unwrap();
    let first = ready(host, 0, "First").await;
    let source = root.path().join("specs/home.screen.html");
    fs::write(&source, "---\ntitle: Home\n---\n<h1>Second</h1>").unwrap();
    let second = ready(host, first["revision"].as_u64().unwrap(), "Second").await;
    assert_eq!(first["deploymentId"], second["deploymentId"]);
    assert_ne!(first["screens"][0]["views"], second["screens"][0]["views"]);
    fs::write(&source, "---\ntitle: Broken").unwrap();
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let next = changed.notified();
            if lines
                .lock()
                .unwrap()
                .iter()
                .any(|line| line.contains("[mokly/build-invalid]"))
            {
                break;
            }
            next.await;
        }
    })
    .await
    .unwrap();
    assert_eq!(index(host).await, second);
    assert!(
        get(host, "/static/mokly-generated/home/index.mobile.html")
            .await
            .contains("Second")
    );
    fs::write(&source, "---\ntitle: Home\n---\n<h1>Recovered</h1>").unwrap();
    let recovered = ready(host, second["revision"].as_u64().unwrap(), "Recovered").await;
    fs::write(root.path().join("theme.css"), "h1 { color: blue }").unwrap();
    let styled = styled(host, recovered["revision"].as_u64().unwrap()).await;
    assert!(
        get(host, "/static/mokly-generated/styles/theme.css")
            .await
            .contains("#00f")
    );
    assert_ne!(styled["live"], recovered["live"]);
    let added = root.path().join("specs/added.screen.html");
    fs::write(&added, "---\ntitle: Added\n---\n<p>New</p>").unwrap();
    membership(host, 2).await;
    fs::remove_file(added).unwrap();
    membership(host, 1).await;
    fs::write(root.path().join("mokly.config.json"), r#"{"colorSchemes":["light","dark"],"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#).unwrap();
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let current = index(host).await;
            if current["screens"][0]["views"].as_array().unwrap().len() == 4 {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    // SAFETY: the PID belongs to this test's live child; SIGTERM requests its documented shutdown.
    assert_eq!(
        unsafe { libc::kill(child.id().unwrap() as i32, libc::SIGTERM) },
        0
    );
    assert!(
        tokio::time::timeout(Duration::from_secs(20), child.wait())
            .await
            .unwrap()
            .unwrap()
            .success()
    );
    logs.await.unwrap();
    assert!(std::net::TcpListener::bind(host).is_ok());
    let lines = lines.lock().unwrap();
    assert!(
        lines
            .iter()
            .any(|line| line.contains("\"stage\":\"watch.action\"")
                && line.contains("\"action\":\"config\""))
    );
    assert!(
        lines
            .iter()
            .any(|line| line.contains("\"stage\":\"watch.action\"")
                && line.contains("\"status\":\"error\""))
    );
}

async fn membership(host: &str, count: usize) {
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            if index(host).await["screens"].as_array().unwrap().len() == count {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}

async fn styled(host: &str, previous: u64) -> Value {
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let candidate = index(host).await;
            if candidate["revision"].as_u64().unwrap() > previous
                && get(host, "/static/mokly-generated/styles/theme.css")
                    .await
                    .contains("#00f")
                && index(host).await["revision"] == candidate["revision"]
            {
                return candidate;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap()
}
