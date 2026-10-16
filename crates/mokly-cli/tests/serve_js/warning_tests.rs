//! Demand wins a blocked background pass; failures retain warnings across repair.

use std::ffi::CString;
use std::fs;
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::support::{Serve, get, source, write};

fn warned(label: &str, fail: bool, additional: bool) -> String {
    let tail = if fail {
        "<a href=\"mock:missing\">Broken</a>"
    } else {
        ""
    };
    let child = if additional {
        "<span tabIndex={-1}>Extra focus</span>"
    } else {
        "Continue"
    };
    format!(
        r#"import fs from 'node:fs';
import {{defineScreen, MockLink}} from '@mokly/mokly';
export default defineScreen({{title:'Home',description:'',relatedDocs:[],props:{{}},
render(_, context) {{
  if (context.viewport === 'mobile') {{
    process.stderr.write('fixture-background-{label}\n');
    fs.readFileSync('warning-gate');
    return <h1>{label}</h1>;
  }}
  return <><h1>{label}</h1><button><MockLink asChild to="home"><span>{child}</span></MockLink></button>{tail}</>;
}}}});"#
    )
}

fn count(serve: &Serve, needle: &str) -> usize {
    serve
        .lines
        .lock()
        .unwrap()
        .iter()
        .filter(|line| line.contains(needle))
        .count()
}

async fn release(serve: &Serve) {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::fs::write(serve.path("warning-gate"), b"go"),
    )
    .await
    .unwrap()
    .unwrap();
}

async fn failed_document(serve: &Serve) {
    let mut socket = TcpStream::connect(&serve.host).await.unwrap();
    socket.write_all(format!(
        "GET /static/mokly-generated/home/index.desktop.html HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n", serve.host,
    ).as_bytes()).await.unwrap();
    let mut text = String::new();
    socket.read_to_string(&mut text).await.unwrap();
    assert!(text.starts_with("HTTP/1.1 500"), "{text}");
    assert!(
        !text.contains("two targets"),
        "warnings must stay private: {text}"
    );
}

#[tokio::test]
async fn build_warning_demand_reports_once_and_failed_attempt_repair_prints_only_new_warnings() {
    for mode in ["plain", "rich"] {
        let mut serve = Serve::options(&source("Initial"), "2", mode, &|root, _| {
            let path = CString::new(root.join("warning-gate").to_str().unwrap()).unwrap();
            // SAFETY: the path is an owned nul-terminated string in this test's private directory.
            assert_eq!(unsafe { libc::mkfifo(path.as_ptr(), 0o600) }, 0);
        })
        .await;
        serve.listening().await;
        if mode == "rich" {
            serve
                .wait_line(0, "Git comparison is unavailable in this build.")
                .await;
        }
        let initial = serve.ready(0, "Initial").await;
        let file = serve.path("specs/home.mockup.tsx");
        let ancestor =
            "MockLink child control is inside <button>; one click or key press has two targets";
        write(&file, &warned("Demand", false, false));
        serve.wait_line(0, "fixture-background-Demand").await;
        assert_eq!(count(&serve, "MockLink child control is inside"), 0);
        assert!(
            get(
                &serve.host,
                "/static/mokly-generated/home/index.desktop.html"
            )
            .await
            .contains("Demand")
        );
        let first = serve.wait_line(0, "MockLink child control is inside").await;
        let prefix = if mode == "plain" {
            "[mokly/warning]"
        } else {
            "  !"
        };
        assert_eq!(
            first.trim_end_matches('\r'),
            if mode == "plain" {
                format!("{prefix} home/index.desktop.html: {ancestor}")
            } else {
                "  ! home/index.desktop.html: MockLink child control is inside <button>; one cli…"
                    .into()
            }
        );
        assert!(
            get(
                &serve.host,
                "/static/mokly-generated/home/index.desktop.html"
            )
            .await
            .contains("Demand")
        );
        release(&serve).await;
        let demand = serve
            .ready(initial["revision"].as_u64().unwrap(), "Demand")
            .await;
        assert_eq!(count(&serve, "MockLink child control is inside"), 1);

        write(&file, &warned("Failure", true, false));
        serve.wait_line(0, "fixture-background-Failure").await;
        failed_document(&serve).await;
        serve.wait_line(0, "unknown-link-target").await;
        release(&serve).await;
        let failure = serve.index().await;
        assert!(failure["revision"].as_u64().unwrap() > demand["revision"].as_u64().unwrap());
        assert_eq!(count(&serve, "MockLink child control is inside"), 2);

        write(&file, &warned("Repaired", false, true));
        serve.wait_line(0, "fixture-background-Repaired").await;
        assert!(
            get(
                &serve.host,
                "/static/mokly-generated/home/index.desktop.html"
            )
            .await
            .contains("Repaired")
        );
        serve.wait_line(0, "MockLink child control contains").await;
        assert!(
            get(
                &serve.host,
                "/static/mokly-generated/home/index.desktop.html"
            )
            .await
            .contains("Repaired")
        );
        release(&serve).await;
        let repaired = serve
            .ready(failure["revision"].as_u64().unwrap(), "Repaired")
            .await;
        assert_eq!(count(&serve, "MockLink child control is inside"), 2);
        assert_eq!(count(&serve, "MockLink child control contains"), 1);
        assert_eq!(serve.index().await["deploymentId"], initial["deploymentId"]);
        let expected = if mode == "rich" {
            let marker = serve.log_count();
            serve.key(b"r");
            serve.wait_line(marker, "manual rebuild").await;
            serve
                .ready(repaired["revision"].as_u64().unwrap(), "Repaired")
                .await;
            (3, 2)
        } else {
            (2, 1)
        };
        // SAFETY: this PID is the live child owned by the test.
        assert_eq!(
            unsafe { libc::kill(serve.child.id().unwrap() as i32, libc::SIGTERM) },
            0
        );
        serve.closed().await;
        assert_eq!(
            count(&serve, "MockLink child control is inside"),
            expected.0
        );
        assert_eq!(count(&serve, "MockLink child control contains"), expected.1);
        assert_eq!(fs::read_dir(serve.path("specs")).unwrap().count(), 2);
    }
}
