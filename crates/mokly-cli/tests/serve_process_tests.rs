//! Native Serve installs signals before readiness and creates no sidecar or output.

#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

struct Running {
    child: Child,
    root: TempDir,
    url: String,
}

async fn start(extra: &[&str]) -> Running {
    let root = TempDir::new().unwrap();
    write(root.path(), "mokly.config.json", "{}");
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    write(
        root.path(),
        "viewer/browser.manifest.json",
        r#"{"schemaVersion":1,"modules":["shell.js","inspector.js"]}"#,
    );
    for path in [
        "viewer/browser/shell.js",
        "viewer/browser/inspector.js",
        "viewer/shell.css",
        "viewer/assets/fonts/InterVariable.woff2",
    ] {
        write(root.path(), path, "");
    }
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--no-watch", "--port", "0"])
        .args(extra)
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "plain")
        .env("PATH", "")
        .env("MOKLY_VIEWER_DIST", root.path().join("viewer"))
        .env_remove("MOKLY_SIDECARS")
        .env_remove("CI")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap()).lines();
    let line = tokio::time::timeout(Duration::from_secs(15), stdout.next_line())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let url = line.strip_prefix("Mokly listening at ").unwrap().to_owned();
    assert!(url.starts_with("http://127.0.0.1:"));
    assert!(!url.ends_with(":0"));
    Running { child, root, url }
}

async fn close(mut running: Running, signal: &str) -> (String, String) {
    let pid = running.child.id().unwrap().to_string();
    let mut request = std::process::Command::new("kill");
    request.arg(signal).arg(&pid);
    if signal == "-INT" {
        request.arg(&pid);
    }
    assert!(request.status().unwrap().success());
    let status = tokio::time::timeout(Duration::from_secs(15), running.child.wait())
        .await
        .unwrap()
        .unwrap();
    let mut stderr = String::new();
    running
        .child
        .stderr
        .take()
        .unwrap()
        .read_to_string(&mut stderr)
        .await
        .unwrap();
    assert_eq!(status.code(), Some(0), "{stderr}");
    assert!(!running.root.path().join("mokly-static").exists());
    assert!(!running.root.path().join("mokly-generated").exists());
    (running.url, stderr)
}

#[tokio::test]
async fn repeated_sigint_and_sigterm_exit_zero_and_release_the_port() {
    for signal in ["-INT", "-TERM"] {
        let running = start(&[]).await;
        let (url, stderr) = close(running, signal).await;
        assert!(stderr.is_empty(), "{stderr}");
        assert!(std::net::TcpListener::bind(url.strip_prefix("http://").unwrap()).is_ok());
    }
}

#[tokio::test]
async fn debug_timings_keep_plain_stdout_and_emit_safe_json() {
    let running = start(&["--debug-timings"]).await;
    let (_, stderr) = close(running, "-TERM").await;
    let records: Vec<_> = stderr
        .lines()
        .map(|line| {
            serde_json::from_str::<serde_json::Value>(line.strip_prefix("[mokly:timing] ").unwrap())
                .unwrap()
        })
        .collect();
    assert_eq!(records.len(), 2);
    assert_eq!(records[0]["event"], "start");
    assert_eq!(records[1]["event"], "end");
    assert_eq!(records[0]["session"], records[1]["session"]);
    for record in records {
        assert_eq!(record["schemaVersion"], 1);
        assert_eq!(record["role"], "core");
        assert!(record.get("props").is_none());
    }
}

#[tokio::test]
async fn a_configured_javascript_renderer_fails_before_listening() {
    let root = TempDir::new().unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"renderer":"./renderer.source.tsx"}"#,
    );
    write(
        root.path(),
        "renderer.source.tsx",
        "import './helper.js'; export default {};",
    );
    write(
        root.path(),
        "helper.js",
        "export const secret = 'private source';",
    );
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--no-watch", "--port", "0"])
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "plain")
        .env("PATH", "")
        .env_remove("MOKLY_SIDECARS")
        .kill_on_drop(true)
        .output()
        .await
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("JavaScript renderer is unavailable"));
}
