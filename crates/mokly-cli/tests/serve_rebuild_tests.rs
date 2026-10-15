//! A real TTY shortcut rebuilds one complete publication and keeps last-good state.

#![cfg(unix)]

use std::fs::{self, File};
use std::io::Write;
use std::os::fd::FromRawFd;
use std::process::Stdio;
use std::ptr;
use std::time::Duration;

use serde_json::Value;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;

fn terminal() -> (File, File) {
    let mut master = -1;
    let mut slave = -1;
    // SAFETY: openpty writes two descriptor slots. Null options select defaults.
    let result = unsafe {
        libc::openpty(
            &mut master,
            &mut slave,
            ptr::null_mut(),
            ptr::null(),
            ptr::null(),
        )
    };
    assert_eq!(result, 0);
    // SAFETY: successful openpty gives two distinct owned file descriptors.
    unsafe { (File::from_raw_fd(master), File::from_raw_fd(slave)) }
}

async fn get(host: &str, path: &str) -> String {
    let mut socket = TcpStream::connect(host).await.unwrap();
    socket
        .write_all(
            format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .await
        .unwrap();
    let mut response = String::new();
    socket.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 200"), "{response}");
    response.split_once("\r\n\r\n").unwrap().1.into()
}

#[tokio::test]
async fn manual_rebuild_publishes_a_fenced_state_and_failed_candidates_keep_it() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    let source = root.path().join("specs/home.screen.html");
    fs::write(&source, "---\ntitle: Home\n---\n<h1>First render</h1>").unwrap();
    for (path, bytes) in [
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
    let (mut input, slave) = terminal();
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--port", "0"])
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "rich")
        .env("NO_COLOR", "1")
        .env("PATH", "")
        .env("MOKLY_VIEWER_DIST", root.path().join("viewer"))
        .env_remove("MOKLY_SIDECARS")
        .env_remove("CI")
        .stdin(Stdio::from(slave))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let mut output = BufReader::new(child.stdout.take().unwrap()).lines();
    let host = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let line = output.next_line().await.unwrap().unwrap();
            if let Some(url) = line
                .split_whitespace()
                .find(|part| part.starts_with("http://"))
            {
                break url.strip_prefix("http://").unwrap().to_owned();
            }
        }
    })
    .await
    .unwrap();
    let first: Value = serde_json::from_str(&get(&host, "/mokly-viewer/index.json").await).unwrap();
    let capability: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/live.json").await).unwrap();
    assert_eq!(first["revision"], 1);
    fs::write(&source, "---\ntitle: Home\n---\n<h1>Second render</h1>").unwrap();
    input.write_all(b"r").unwrap();
    let second = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let value: Value =
                serde_json::from_str(&get(&host, "/mokly-viewer/index.json").await).unwrap();
            if value["revision"] == 2 {
                break value;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(first["deploymentId"], second["deploymentId"]);
    assert_ne!(first["live"], second["live"]);
    let detail: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/entries/home.json").await).unwrap();
    assert_eq!(detail["revision"], 2);
    assert_eq!(detail["deploymentId"], second["deploymentId"]);
    assert!(
        get(&host, "/static/mokly-generated/home/index.mobile.html")
            .await
            .contains("Second render")
    );
    let next_capability: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/live.json").await).unwrap();
    assert_eq!(
        capability["render"]["token"],
        next_capability["render"]["token"]
    );
    fs::write(&source, "---\ntitle: Broken").unwrap();
    input.write_all(b"r").unwrap();
    let mut errors = BufReader::new(child.stderr.take().unwrap()).lines();
    let error = tokio::time::timeout(Duration::from_secs(15), errors.next_line())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert!(error.contains("[mokly/build-invalid]"), "{error}");
    let retained: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/index.json").await).unwrap();
    assert_eq!(retained, second);
    assert!(
        get(&host, "/static/mokly-generated/home/index.mobile.html")
            .await
            .contains("Second render")
    );
    input.write_all(b"q").unwrap();
    let status = tokio::time::timeout(Duration::from_secs(15), child.wait())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(status.code(), Some(0));
    assert!(std::net::TcpListener::bind(host).is_ok());
}
