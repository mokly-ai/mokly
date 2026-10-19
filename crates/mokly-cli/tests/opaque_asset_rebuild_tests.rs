//! Watched assets regenerate; snapshot assets require a restart without adopting edits.

#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::mpsc::{self, UnboundedReceiver};
use tokio::task::JoinHandle;

const RESOURCE: &str = "/static/mokly-generated/assets/css/image.svg";

#[tokio::test]
async fn snapshot_asset_mismatch_preserves_the_generation_and_names_the_recovery() {
    let root = fixture();
    let mut serve = Serve::start(root.path(), false).await;
    let first = serve.index().await;
    assert_eq!(get(&serve.host, RESOURCE).await, (200, "before".into()));
    fs::write(root.path().join("css/image.svg"), "edited").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Edited\n---\n<p>Edited</p>",
    )
    .unwrap();
    assert_eq!(get(&serve.host, RESOURCE).await.0, 500);
    until(&mut serve.stderr, "Restart Serve or use watching.").await;
    let current = serve.index().await;
    assert_eq!(current["live"]["generation"], first["live"]["generation"]);
    assert_eq!(current["screens"][0]["title"], "Home");
    assert_eq!(get(&serve.host, RESOURCE).await.0, 500);
    let (stdout, stderr) = serve.close().await;
    assert!(stderr.iter().any(|line| line.contains("css/image.svg")));
    assert_eq!(
        stdout
            .iter()
            .filter(|line| line.contains("Catalogue ready"))
            .count(),
        1,
        "{stdout:?}"
    );
}

#[tokio::test]
async fn watched_asset_edits_publish_a_new_generation_before_the_completion_line() {
    let root = fixture();
    let mut serve = Serve::start(root.path(), true).await;
    let first = serve.index().await;
    assert_eq!(get(&serve.host, RESOURCE).await, (200, "before".into()));
    fs::write(root.path().join("css/image.svg"), "edited").unwrap();
    let response = get(&serve.host, RESOURCE).await;
    assert!(matches!(response.0, 200 | 500), "{response:?}");
    if response.0 == 200 {
        assert_eq!(response.1, "edited");
    }
    until(&mut serve.stdout, " rebuilt").await;
    let next = serve.index().await;
    assert_ne!(next["live"]["generation"], first["live"]["generation"]);
    assert!(next["revision"].as_u64().unwrap() > first["revision"].as_u64().unwrap());
    assert_eq!(get(&serve.host, RESOURCE).await, (200, "edited".into()));
    let (_, stderr) = serve.close().await;
    if response.0 == 500 {
        assert!(stderr.iter().any(|line| line.contains("css/image.svg")));
    }
    assert!(
        !stderr
            .iter()
            .any(|line| line.contains("Restart Serve or use watching."))
    );
}

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("css")).unwrap();
    for (path, text) in [
        (
            "mokly.config.json",
            r#"{"stylesheets":[{"match":"**","stylesheets":["css/main.css"]}]}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
        ("css/main.css", ".image{background:url('./image.svg')}"),
        ("css/image.svg", "before"),
    ] {
        fs::write(root.path().join(path), text).unwrap();
    }
    root
}

struct Serve {
    child: Child,
    host: String,
    stdout: UnboundedReceiver<String>,
    stderr: UnboundedReceiver<String>,
    stdout_log: JoinHandle<Vec<String>>,
    stderr_log: JoinHandle<Vec<String>>,
}

impl Serve {
    async fn start(root: &Path, watching: bool) -> Self {
        let viewer = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/viewer/dist")
            .canonicalize()
            .unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
            .args([
                "serve",
                if watching { "--watch" } else { "--no-watch" },
                "--port",
                "0",
            ])
            .current_dir(root)
            .env("PATH", "")
            .env("MOKLY_OUTPUT", "rich")
            .env("NO_COLOR", "1")
            .env("MOKLY_VIEWER_DIST", viewer)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let (mut stdout, stdout_log) = lines(Box::new(child.stdout.take().unwrap()));
        let (stderr, stderr_log) = lines(Box::new(child.stderr.take().unwrap()));
        let address = until(&mut stdout, "http://127.0.0.1:").await;
        let host = address
            .split_whitespace()
            .find_map(|word| word.strip_prefix("http://"))
            .unwrap()
            .to_owned();
        until(&mut stdout, "Catalogue ready").await;
        Self {
            child,
            host,
            stdout,
            stderr,
            stdout_log,
            stderr_log,
        }
    }
    async fn index(&self) -> Value {
        let (status, text) = get(&self.host, "/mokly-viewer/index.json").await;
        assert_eq!(status, 200);
        serde_json::from_str(&text).unwrap()
    }
    async fn close(mut self) -> (Vec<String>, Vec<String>) {
        let status = Command::new("kill")
            .args(["-INT", &self.child.id().unwrap().to_string()])
            .status()
            .await
            .unwrap();
        assert!(status.success());
        let status = tokio::time::timeout(Duration::from_secs(15), self.child.wait())
            .await
            .unwrap()
            .unwrap();
        let stdout = self.stdout_log.await.unwrap();
        let stderr = self.stderr_log.await.unwrap();
        assert_eq!(status.code(), Some(0), "{stderr:?}");
        (stdout, stderr)
    }
}

fn lines(
    stream: Box<dyn AsyncRead + Unpin + Send>,
) -> (UnboundedReceiver<String>, JoinHandle<Vec<String>>) {
    let (send, receive) = mpsc::unbounded_channel();
    let task = tokio::spawn(async move {
        let mut reader = BufReader::new(stream).lines();
        let mut output = Vec::new();
        while let Some(line) = reader.next_line().await.unwrap() {
            let _ = send.send(line.clone());
            output.push(line);
        }
        output
    });
    (receive, task)
}

async fn until(lines: &mut UnboundedReceiver<String>, text: &str) -> String {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let line = lines.recv().await.expect("Serve output ended");
            if line.contains(text) {
                return line;
            }
        }
    })
    .await
    .unwrap()
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
    (
        headers.split_whitespace().nth(1).unwrap().parse().unwrap(),
        body.into(),
    )
}
