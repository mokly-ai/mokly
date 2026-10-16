//! Real CLI fixture with observed readiness, a TTY, and captured worker counts.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::Value;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::Notify;
use tokio::task::JoinHandle;

pub(super) struct Serve {
    pub(super) root: TempDir,
    pub(super) child: Child,
    pub(super) host: String,
    input: File,
    pub(super) lines: Arc<Mutex<Vec<String>>>,
    ready: Arc<Notify>,
    readers: Vec<JoinHandle<()>>,
}
impl Serve {
    pub(super) async fn launch(source: &str) -> Self {
        Self::configured(source, &|_, _| {}).await
    }
    pub(super) async fn configured(source: &str, configure: &dyn Fn(&Path, &Path)) -> Self {
        Self::options(source, "1", "rich", configure).await
    }
    pub(super) async fn options(
        source: &str,
        sidecars: &str,
        mode: &str,
        configure: &dyn Fn(&Path, &Path),
    ) -> Self {
        let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        std::os::unix::fs::symlink(
            workspace.join("node_modules"),
            root.path().join("node_modules"),
        )
        .unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(root.path().join("specs/home.mockup.tsx"), source).unwrap();
        fs::write(
            root.path().join("specs/view.module.css"),
            ".card { color: red }",
        )
        .unwrap();
        let (package, input, slave) = super::fixture::terminal(root.path(), &workspace);
        configure(root.path(), &package);
        let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
            .args(["serve", "--port", "0", "--sidecars", sidecars])
            .current_dir(root.path())
            .env("MOKLY_PACKAGE_ROOT", package)
            .env("MOKLY_VIEWER_DIST", workspace.join("packages/viewer/dist"))
            .env("MOKLY_OUTPUT", mode)
            .env("NO_COLOR", "1")
            .env_remove("CI")
            .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
            .env_remove("MOKLY_SIDECARS")
            .stdin(Stdio::from(slave))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let lines = Arc::new(Mutex::new(Vec::new()));
        let ready = Arc::new(Notify::new());
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let readers = vec![
            read(stdout, lines.clone(), ready.clone()),
            read(stderr, lines.clone(), ready.clone()),
        ];
        Self {
            root,
            child,
            host: String::new(),
            input,
            lines,
            ready,
            readers,
        }
    }
    pub(super) async fn start(source: &str) -> Self {
        let mut serve = Self::launch(source).await;
        serve.listening().await;
        serve
    }
    pub(super) async fn listening(&mut self) {
        let line = self.wait_line(0, "http://").await;
        self.host = line
            .split_whitespace()
            .find(|part| part.starts_with("http://"))
            .unwrap()
            .trim_start_matches("http://")
            .into();
    }
    pub(super) fn path(&self, path: &str) -> PathBuf {
        self.root.path().join(path)
    }
    pub(super) fn key(&mut self, key: &[u8]) {
        self.input.write_all(key).unwrap();
    }
    pub(super) fn log_count(&self) -> usize {
        self.lines.lock().unwrap().len()
    }
    pub(super) fn compiles(&self) -> usize {
        self.lines
            .lock()
            .unwrap()
            .iter()
            .filter(|line| line.as_str() == "fixture-esbuild")
            .count()
    }
    pub(super) fn evaluations(&self) -> usize {
        self.lines
            .lock()
            .unwrap()
            .iter()
            .filter(|line| line.starts_with("fixture-worker:"))
            .count()
    }
    pub(super) async fn wait_line(&self, start: usize, text: &str) -> String {
        tokio::time::timeout(Duration::from_secs(30), async {
            loop {
                let ready = self.ready.notified();
                if let Some(line) = self
                    .lines
                    .lock()
                    .unwrap()
                    .iter()
                    .skip(start)
                    .find(|line| line.contains(text))
                {
                    return line.clone();
                }
                ready.await;
            }
        })
        .await
        .unwrap_or_else(|_| {
            let lines = self.lines.lock().unwrap().clone();
            panic!("missing {text}; logs: {lines:?}")
        })
    }
    pub(super) async fn index(&self) -> Value {
        serde_json::from_str(&get(&self.host, "/mokly-viewer/index.json").await).unwrap()
    }
    pub(super) async fn html(&self) -> String {
        get(&self.host, "/static/mokly-generated/home/index.mobile.html").await
    }
    /// This fixture publishes adoption and then one complete two-view usage pass.
    pub(super) async fn ready(&self, previous: u64, text: &str) -> Value {
        tokio::time::timeout(Duration::from_secs(30), async {
            let mut socket = TcpStream::connect(&self.host).await.unwrap();
            socket
                .write_all(
                    format!(
                        "GET /mokly-viewer/events HTTP/1.1\r\nHost: {}\r\n\r\n",
                        self.host
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
            let mut events = BufReader::new(socket).lines();
            loop {
                let Some(line) = events.next_line().await.unwrap() else {
                    panic!("event stream closed before readiness")
                };
                let Some(revision) = line
                    .strip_prefix("id: ")
                    .and_then(|id| id.trim().parse::<u64>().ok())
                else {
                    continue;
                };
                if revision < previous + 2 {
                    continue;
                }
                let index = self.index().await;
                let detail: Value =
                    serde_json::from_str(&get(&self.host, "/mokly-viewer/entries/home.json").await)
                        .unwrap();
                if index["revision"].as_u64().unwrap() >= previous + 2
                    && index["revision"] == detail["revision"]
                    && detail["workspace"].is_object()
                    && self.html().await.contains(text)
                {
                    return index;
                }
            }
        })
        .await
        .unwrap()
    }
    pub(super) async fn stop(&mut self) {
        self.key(b"q");
        self.closed().await;
    }
    pub(super) async fn closed(&mut self) {
        assert!(
            tokio::time::timeout(Duration::from_secs(30), self.child.wait())
                .await
                .unwrap()
                .unwrap()
                .success()
        );
        for reader in self.readers.drain(..) {
            reader.await.unwrap();
        }
        if !self.host.is_empty() {
            assert!(std::net::TcpListener::bind(&self.host).is_ok());
        }
    }
}
impl Drop for Serve {
    fn drop(&mut self) {
        for line in self
            .lines
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
        {
            if let Some(pid) = line
                .strip_prefix("fixture-worker:")
                .and_then(|pid| pid.parse::<i32>().ok())
            {
                // SAFETY: this PID came from this fixture's own sidecar, which owns its process group.
                unsafe {
                    libc::kill(-pid, libc::SIGKILL);
                }
            }
        }
    }
}
fn read<R: tokio::io::AsyncRead + Unpin + Send + 'static>(
    reader: R,
    lines: Arc<Mutex<Vec<String>>>,
    ready: Arc<Notify>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut reader = BufReader::new(reader).lines();
        while let Some(line) = reader.next_line().await.unwrap() {
            lines.lock().unwrap().push(line);
            ready.notify_one();
        }
    })
}
pub(super) async fn get(host: &str, path: &str) -> String {
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

pub(super) fn source(label: &str) -> String {
    format!(
        "import {{defineScreen}} from '@mokly/mokly'; import styles from './view.module.css'; process.stderr.write('fixture-worker:'+process.pid+'\\n'); export default defineScreen({{title:'Home',description:'',relatedDocs:[],props:{{}},render:()=> <h1 className={{styles.card}}>{label}</h1>}});"
    )
}

pub(super) fn write(path: &Path, bytes: &str) {
    fs::write(path, bytes).unwrap();
}
