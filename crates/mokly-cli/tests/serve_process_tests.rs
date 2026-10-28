//! Native Serve installs signals before readiness and creates no sidecar or output.

#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, ChildStderr, Command};

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

struct Running {
    child: Child,
    root: TempDir,
    url: String,
    errors: BufReader<ChildStderr>,
    prefix: String,
}

async fn start(extra: &[&str]) -> Running {
    let root = TempDir::new().unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"stylesheets":[{"match":"**","stylesheets":["styles.css"]}]}"#,
    );
    write(root.path(), "styles.css", "button { color: blue; }");
    write(
        root.path(),
        "specs/button.component.html",
        "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}, required: [label]}\nprops: {label: Saved}\n---\n<button>{{label}}</button>",
    );
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1><ui-button label=\"Home\"></ui-button>",
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
        "viewer/assets/brand.svg",
    ] {
        write(root.path(), path, "");
    }
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--no-watch", "--port", "0"])
        .args(extra)
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "plain")
        .env("PATH", "")
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("MOKLY_NODE_EXECUTABLE")
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
        .unwrap();
    let Some(line) = line else {
        let output = child.wait_with_output().await.unwrap();
        panic!(
            "Serve exited before readiness: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    };
    let url = line.strip_prefix("Mokly listening at ").unwrap().to_owned();
    assert!(url.starts_with("http://127.0.0.1:"));
    assert!(!url.ends_with(":0"));
    let mut errors = BufReader::new(child.stderr.take().unwrap());
    let mut prefix = String::new();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let mut line = String::new();
            assert!(errors.read_line(&mut line).await.unwrap() > 0);
            prefix.push_str(&line);
            if line.contains("[mokly/git-failed]") {
                break;
            }
        }
    })
    .await
    .unwrap();
    Running {
        child,
        root,
        url,
        errors,
        prefix,
    }
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
    let mut stderr = running.prefix;
    running.errors.read_to_string(&mut stderr).await.unwrap();
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
        assert_eq!(stderr.lines().count(), 1, "{stderr}");
        assert!(stderr.contains("[mokly/git-failed]"), "{stderr}");
        assert!(std::net::TcpListener::bind(url.strip_prefix("http://").unwrap()).is_ok());
    }
}

#[tokio::test]
async fn debug_timings_keep_plain_stdout_and_emit_safe_json() {
    let running = start(&["--debug-timings"]).await;
    let (_, stderr) = close(running, "-TERM").await;
    assert_eq!(
        stderr
            .lines()
            .filter(|line| line.contains("[mokly/git-failed]"))
            .count(),
        1,
        "{stderr}"
    );
    let records: Vec<_> = stderr
        .lines()
        .filter_map(|line| line.strip_prefix("[mokly:timing] "))
        .map(|line| serde_json::from_str::<serde_json::Value>(line).unwrap())
        .collect();
    let starts: std::collections::BTreeMap<_, _> = records
        .iter()
        .filter(|record| record["event"] == "start")
        .map(|record| {
            (
                record["id"].as_u64().unwrap(),
                record["stage"].as_str().unwrap(),
            )
        })
        .collect();
    for stage in [
        "serve.ready",
        "config.load",
        "catalogue.discover",
        "catalogue.validate",
        "graph.prepare",
        "css.bundle",
        "index.build",
        "detail.build",
        "render.document",
        "render.fragment",
        "serve.background",
    ] {
        assert!(
            starts.values().any(|actual| *actual == stage),
            "missing {stage}"
        );
    }
    let position = |stage, event| {
        records
            .iter()
            .position(|record| record["stage"] == stage && record["event"] == event)
            .unwrap()
    };
    assert!(position("catalogue.discover", "end") < position("catalogue.validate", "start"));
    assert!(position("catalogue.validate", "end") < position("graph.prepare", "start"));
    assert!(position("graph.prepare", "end") < position("serve.ready", "end"));
    let counts = records
        .iter()
        .find(|record| record["stage"] == "serve.background" && record["event"] == "counts")
        .unwrap();
    assert_eq!(counts["documents"], 4);
    assert!(counts["fragments"].as_u64().unwrap() > 0);
    assert!(counts["cacheHits"].is_u64());
    let background = records
        .iter()
        .find(|record| record["stage"] == "serve.background" && record["event"] == "start")
        .unwrap();
    let cache = records
        .iter()
        .find(|record| record["stage"] == "render.cache" && record["phase"] == "serve.background")
        .unwrap();
    assert_eq!(cache["event"], "counts");
    assert_eq!(cache["parentId"], background["id"]);
    assert!(cache["misses"].as_u64().unwrap() > 0);
    assert!(cache["chargedBytes"].as_u64().unwrap() > 0);
    for record in &records {
        assert_eq!(record["schemaVersion"], 1);
        assert_eq!(record["role"], "core");
        assert_eq!(record["session"], records[0]["session"]);
        assert!(record["elapsedMs"].is_number());
        if record["event"] == "end" {
            assert_eq!(starts[&record["id"].as_u64().unwrap()], record["stage"]);
            assert_eq!(record["status"], "ok");
            assert!(record["durationMs"].is_number());
        }
        if record["stage"] == "render.document" && record["event"] == "end" {
            assert!(matches!(
                record["viewport"].as_str(),
                Some("mobile" | "desktop")
            ));
            assert_eq!(record["scheme"], "light");
        }
    }
    for source_text in ["Home", "styles.css", "label", "<button>"] {
        assert!(!stderr.contains(source_text));
    }
}

#[tokio::test]
async fn a_configured_renderer_without_node_fails_before_listening() {
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
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("MOKLY_NODE_EXECUTABLE")
        .env_remove("MOKLY_SIDECARS")
        .kill_on_drop(true)
        .output()
        .await
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("node is unavailable"));
}
