//! Historical JavaScript and PostCSS stop when their owning native command dies.

#![cfg(unix)]

use std::fs;
use std::os::unix::process::ExitStatusExt;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[expect(
    dead_code,
    reason = "this fixture owns its asynchronous command lifetime"
)]
mod changes_support;
use changes_support::{base, write};

const PAGE: &str = "import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render(){ BODY }});";
const MARKER: &str = "fixture-base-processes:";

struct Children(Vec<i32>);
impl Drop for Children {
    fn drop(&mut self) {
        for pid in &self.0 {
            if alive(*pid) {
                // SAFETY: each PID came from this fixture's own historical code.
                unsafe {
                    libc::kill(*pid, libc::SIGKILL);
                }
            }
        }
    }
}

fn alive(pid: i32) -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(status) = fs::read_to_string(format!("/proc/{pid}/stat"))
        && status
            .rsplit_once(") ")
            .is_some_and(|(_, fields)| fields.starts_with("Z "))
    {
        return false;
    }
    // SAFETY: signal zero only checks a PID recorded by this fixture.
    unsafe { libc::kill(pid, 0) == 0 }
}

#[tokio::test]
async fn killing_build_ends_the_historical_sidecar_and_a_blocked_postcss_child() {
    for css in [false, true] {
        let root = base(&[(
            "specs/home.mockup.ts",
            &PAGE.replace("BODY", if css {
                "return '<!doctype html><html><head><title>Home</title></head><body>Home</body></html>';"
            } else {
                "process.stderr.write('fixture-base-processes:'+JSON.stringify([process.pid])+'\\n'); while(true){}"
            }),
        )]);
        if css {
            write(
                root.path(),
                "mokly.config.json",
                r#"{"review":{"base":"fixture-base"},"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
            );
            fs::remove_file(root.path().join("specs/home.mockup.ts")).unwrap();
            write(
                root.path(),
                "specs/home.screen.html",
                "---\ntitle: Home\n---\n<h1>Home</h1>",
            );
            write(root.path(), "style.css", "h1{color:red}");
            write(
                root.path(),
                "postcss.mjs",
                "export default {plugins:[{postcssPlugin:'base-death',Once(){process.stderr.write('fixture-base-processes:'+JSON.stringify([process.ppid,process.pid])+'\\n'); while(true){} }}]};",
            );
            changes_support::git(root.path(), &["add", "."]);
            changes_support::git(
                root.path(),
                &[
                    "-c",
                    "user.name=Fixture",
                    "-c",
                    "user.email=fixture@example.test",
                    "commit",
                    "-m",
                    "base css",
                ],
            );
            write(root.path(), "postcss.mjs", "export default {plugins:[]};");
        } else {
            write(root.path(), "specs/home.mockup.ts", &PAGE.replace("BODY", "return '<!doctype html><html><head><title>Home</title></head><body>Current</body></html>';"));
        }
        let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        std::os::unix::fs::symlink(
            workspace.join("node_modules"),
            root.path().join("node_modules"),
        )
        .unwrap();
        let cache = tempfile::tempdir().unwrap();
        let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
            .args(["build", "--sidecars", "1"])
            .current_dir(root.path())
            .env("MOKLY_PACKAGE_ROOT", workspace.join("packages/mokly"))
            .env("XDG_CACHE_HOME", cache.path())
            .env("MOKLY_OUTPUT", "plain")
            .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
            .env_remove("MOKLY_SIDECARS")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut stderr = BufReader::new(child.stderr.take().unwrap()).lines();
        let processes = tokio::time::timeout(Duration::from_secs(30), async {
            let mut lines = Vec::new();
            while let Some(line) = stderr.next_line().await.unwrap() {
                if let Some((_, pids)) = line.split_once(MARKER) {
                    return serde_json::from_str::<Vec<i32>>(pids).unwrap();
                }
                lines.push(line);
            }
            panic!("historical code did not start: {lines:?}");
        })
        .await
        .unwrap();
        let processes = Children(processes);
        assert_eq!(processes.0.len(), if css { 2 } else { 1 });
        assert!(processes.0.iter().all(|pid| alive(*pid)));
        child.kill().await.unwrap();
        assert_eq!(child.wait().await.unwrap().signal(), Some(libc::SIGKILL));
        tokio::time::timeout(Duration::from_secs(30), async {
            while processes.0.iter().any(|pid| alive(*pid)) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }
}
