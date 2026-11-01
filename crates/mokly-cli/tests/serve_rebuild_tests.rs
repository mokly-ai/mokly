//! A real TTY shortcut rebuilds one complete publication and keeps last-good state.

#![cfg(unix)]

use std::fs::{self, File};
use std::io::Write;
use std::mem::MaybeUninit;
use std::os::fd::{AsRawFd, FromRawFd};
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
            ptr::null_mut(),
            ptr::null_mut(),
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
        ("viewer/assets/brand.svg", "<svg/>"),
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
    let first = ready(&host, 1).await;
    let capability: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/live.json").await).unwrap();
    assert_eq!(first["revision"], 3);
    assert_eq!(first["changesStatus"], "unavailable");
    fs::write(&source, "---\ntitle: Home\n---\n<h1>Second render</h1>").unwrap();
    let second = ready(&host, first["revision"].as_u64().unwrap() + 3).await;
    assert_eq!(second["revision"], first["revision"].as_u64().unwrap() + 3);
    assert_eq!(first["deploymentId"], second["deploymentId"]);
    assert_ne!(first["live"], second["live"]);
    let detail: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/entries/home.json").await).unwrap();
    assert_eq!(detail["revision"], second["revision"]);
    assert_eq!(detail["detailId"], second["screens"][0]["detailId"]);
    assert!(detail.get("deploymentId").is_none());
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
    input.write_all(b"r").unwrap();
    let manual = ready(&host, second["revision"].as_u64().unwrap() + 2).await;
    assert_eq!(manual["revision"], second["revision"].as_u64().unwrap() + 2);
    assert_eq!(manual["deploymentId"], second["deploymentId"]);
    assert!(
        get(&host, "/static/mokly-generated/home/index.mobile.html")
            .await
            .contains("Second render")
    );
    fs::write(&source, "---\ntitle: Broken").unwrap();
    let mut errors = BufReader::new(child.stderr.take().unwrap()).lines();
    let error = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let line = errors.next_line().await.unwrap().unwrap();
            if line.contains("✖ specs/home.screen.html") {
                break line;
            }
            assert!(
                !line.contains("[mokly/") || line.contains("[mokly/git-failed]"),
                "{line}"
            );
        }
    })
    .await
    .unwrap();
    assert!(error.contains("✖ specs/home.screen.html"), "{error}");
    let error = errors.next_line().await.unwrap().unwrap();
    assert!(
        error.contains("specs/home.screen.html:1:1 [mokly/html-front-matter]"),
        "{error}"
    );
    let retained: Value =
        serde_json::from_str(&get(&host, "/mokly-viewer/index.json").await).unwrap();
    assert_eq!(retained, manual);
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

async fn ready(host: &str, minimum_revision: u64) -> Value {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let index: Value =
                serde_json::from_str(&get(host, "/mokly-viewer/index.json").await).unwrap();
            let detail: Value =
                serde_json::from_str(&get(host, "/mokly-viewer/entries/home.json").await).unwrap();
            if !matches!(
                index["changesStatus"].as_str(),
                Some("pending" | "preparing")
            ) && detail["workspace"].is_object()
                && detail["revision"] == index["revision"]
                && index["revision"].as_u64().unwrap() >= minimum_revision
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
async fn shortcuts_write_carriage_returns_on_a_real_raw_terminal() {
    let root = TempDir::new().unwrap();
    for (path, body) in [
        ("mokly.config.json", "{}"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        (
            "viewer/browser.manifest.json",
            r#"{"schemaVersion":1,"modules":["shell.js","inspector.js"]}"#,
        ),
        ("viewer/browser/shell.js", ""),
        ("viewer/browser/inspector.js", ""),
        ("viewer/shell.css", ""),
        ("viewer/assets/fonts/InterVariable.woff2", ""),
        ("viewer/assets/brand.svg", "<svg/>"),
    ] {
        let path = root.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }
    let (mut input, slave) = terminal();
    let probe = slave.try_clone().unwrap();
    let output = tokio::fs::File::from_std(input.try_clone().unwrap());
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--port", "0"])
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "rich")
        .env("NO_COLOR", "1")
        .env("MOKLY_VIEWER_DIST", root.path().join("viewer"))
        .env_remove("MOKLY_SIDECARS")
        .stdout(Stdio::from(slave.try_clone().unwrap()))
        .stdin(Stdio::from(slave))
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let mut output = BufReader::new(output);
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let mut line = String::new();
            output.read_line(&mut line).await.unwrap();
            assert!(line.ends_with("\r\n"), "{line:?}");
            if line.contains("Catalogue ready") {
                break;
            }
        }
        loop {
            let mut attributes = MaybeUninit::<libc::termios>::uninit();
            // SAFETY: the live probe descriptor writes one initialized termios on success.
            assert_eq!(
                unsafe { libc::tcgetattr(probe.as_raw_fd(), attributes.as_mut_ptr()) },
                0
            );
            // SAFETY: tcgetattr returned success and initialized the complete value.
            if unsafe { attributes.assume_init() }.c_lflag & libc::ICANON == 0 {
                break;
            }
            tokio::task::yield_now().await;
        }
        input.write_all(b"h").unwrap();
        loop {
            let mut line = String::new();
            output.read_line(&mut line).await.unwrap();
            assert!(line.ends_with("\r\n"), "{line:?}");
            assert!(!line.ends_with("\r\r\n"), "{line:?}");
            if line.contains("Ctrl+C") {
                break;
            }
        }
    })
    .await
    .unwrap();
    input.write_all(b"q").unwrap();
    let status = tokio::time::timeout(Duration::from_secs(15), child.wait())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(status.code(), Some(0));
}
