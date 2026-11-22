//! Isolated sidecar instrumentation, a real terminal, and the binary launch for Serve tests.

use std::fs::{self, File};
use std::os::fd::{FromRawFd, OwnedFd};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::ptr;
use std::sync::{Arc, Mutex};

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Notify;
use tokio::task::JoinHandle;
use url::Url;

/// The sidecar package directory inside a fixture root.
const PACKAGE: &str = ".fixture-sidecar";

/// The repository root, which holds the built packages and `node_modules`.
fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}

/// Write a screen with a CSS Module, an empty configuration, a link to the workspace
/// `node_modules`, and the sidecar package. Returns the package directory.
pub(super) fn project(root: &Path, source: &str) -> PathBuf {
    let workspace = workspace();
    fs::create_dir(root.join("specs")).unwrap();
    std::os::unix::fs::symlink(workspace.join("node_modules"), root.join("node_modules")).unwrap();
    fs::write(root.join("mokly.config.json"), "{}").unwrap();
    fs::write(root.join("specs/home.mockup.tsx"), source).unwrap();
    fs::write(root.join("specs/view.module.css"), ".card { color: red }").unwrap();
    package(root, &workspace)
}

/// Write the sidecar package whose entry reports each compile and each PostCSS child start.
fn package(root: &Path, workspace: &Path) -> PathBuf {
    let package = root.join(PACKAGE);
    fs::create_dir_all(package.join("dist")).unwrap();
    fs::copy(
        workspace.join("packages/mokly/package.json"),
        package.join("package.json"),
    )
    .unwrap();
    let target = workspace.join("packages/mokly/dist/sidecar.js");
    fs::write(package.join("dist/sidecar.js"), format!(
            "const write=process.stdout.write.bind(process.stdout); process.stdout.write=(chunk,...args)=>{{try{{const value=JSON.parse(String(chunk)); if(value.event==='operation'&&['esbuild','postcss-start'].includes(value.params.operation)) process.stderr.write('fixture-'+value.params.operation+'\\n');}}catch{{}} return write(chunk,...args);}}; await import({});",
            serde_json::to_string(Url::from_file_path(&target).unwrap().as_str()).unwrap()
        )).unwrap();
    package
}

/// Start `mokly serve` in `root` with its fixture package on a new terminal.
///
/// Returns the child, the terminal input, and the merged standard output and error.
pub(super) fn serve(
    root: &Path,
    cache: [(&'static str, PathBuf); 3],
    sidecars: &str,
    mode: &str,
    environment: &[(&str, &str)],
) -> (Child, File, UnixStream) {
    let (input, slave) = terminal();
    let (output, writer) = UnixStream::pair().unwrap();
    output.set_nonblocking(true).unwrap();
    let child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--port", "0", "--sidecars", sidecars])
        .current_dir(root)
        .envs(cache)
        .envs(environment.iter().copied())
        .env("MOKLY_PACKAGE_ROOT", root.join(PACKAGE))
        .env(
            "MOKLY_VIEWER_DIST",
            workspace().join("packages/viewer/dist"),
        )
        .env("MOKLY_OUTPUT", mode)
        .env("NO_COLOR", "1")
        .env_remove("CI")
        .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
        .env_remove("MOKLY_SIDECARS")
        .stdin(Stdio::from(slave))
        .stdout(Stdio::from(OwnedFd::from(writer.try_clone().unwrap())))
        .stderr(Stdio::from(OwnedFd::from(writer)))
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    (child, input, output)
}

/// Copy each line of the binary output into `lines` and wake each waiter on `ready`.
pub(super) fn read<R: AsyncRead + Unpin + Send + 'static>(
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

fn terminal() -> (File, File) {
    let mut master = -1;
    let mut slave = -1;
    // SAFETY: openpty initializes two descriptor slots; null options select defaults.
    assert_eq!(
        unsafe {
            libc::openpty(
                &mut master,
                &mut slave,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            )
        },
        0
    );
    // SAFETY: successful openpty creates two distinct owned descriptors.
    unsafe { (File::from_raw_fd(master), File::from_raw_fd(slave)) }
}
