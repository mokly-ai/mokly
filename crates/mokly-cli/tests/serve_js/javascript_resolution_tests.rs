//! An installed JavaScript module outside the repository remains observable.

use std::fs;
use std::time::{Duration, Instant, SystemTime};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use super::support::{Serve, source, write};

#[tokio::test]
async fn external_javascript_package_edit_publishes_the_new_module() {
    let started = Instant::now();
    let installation = tempfile::tempdir().unwrap();
    fs::create_dir(installation.path().join("fixture-value")).unwrap();
    write(
        &installation.path().join("fixture-value/package.json"),
        r#"{"name":"fixture-value","main":"index.js"}"#,
    );
    let module = installation.path().join("fixture-value/index.js");
    write(&module, "export const value = 'Before';");
    let preferred = installation.path().join("fixture-value/preferred.js");
    write(&preferred, "export const value = 'Selected';");
    for path in [
        installation.path().join("fixture-value/package.json"),
        module.clone(),
        preferred,
    ] {
        fs::OpenOptions::new()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH)
            .unwrap();
    }
    let screen = format!(
        "import {{value}} from 'fixture-value';\n{}",
        source("{value}")
    );
    let mut serve = Serve::configured(&screen, &|root, _| {
        fs::create_dir(root.join("vendor")).unwrap();
        write(&root.join("vendor/package.json"), "{}");
        std::os::unix::fs::symlink(installation.path(), root.join("vendor/node_modules")).unwrap();
        write(
            &root.join("mokly.config.json"),
            r#"{"moduleResolution":{"packageRoots":["vendor"]}}"#,
        );
    })
    .await;
    serve.listening().await;
    let first = serve.ready(0, "Before").await;
    write(&module, "export const value = 'After';");
    let source_published = published(&serve, first["revision"].as_u64().unwrap(), "After").await;
    let source_html = serve.html().await;
    let previous = serve.index().await["revision"].as_u64().unwrap();
    write(
        &installation.path().join("fixture-value/package.json"),
        r#"{"name":"fixture-value","main":"preferred.js"}"#,
    );
    let metadata_published = published(&serve, previous, "Selected").await;
    let actual = serve.html().await;
    serve.stop().await;
    eprintln!(
        "external JavaScript package watch scenario: {:?}",
        started.elapsed()
    );
    assert_eq!(
        source_published,
        Some(true),
        "source edit left stale HTML: {source_html:?}"
    );
    assert!(source_html.contains("After"), "{source_html}");
    assert_eq!(
        metadata_published,
        Some(true),
        "manifest edit left stale HTML: {actual:?}"
    );
    assert!(actual.contains("Selected"), "{actual}");
}

async fn published(serve: &Serve, previous: u64, expected: &str) -> Option<bool> {
    tokio::time::timeout(Duration::from_secs(30), async {
        let mut socket = TcpStream::connect(&serve.host).await.unwrap();
        socket
            .write_all(
                format!(
                    "GET /mokly-viewer/events HTTP/1.1\r\nHost: {}\r\n\r\n",
                    serve.host
                )
                .as_bytes(),
            )
            .await
            .unwrap();
        let mut events = BufReader::new(socket).lines();
        while let Some(line) = events.next_line().await.unwrap() {
            if line.starts_with("id: ")
                && serve.index().await["revision"].as_u64().unwrap() > previous
                && serve.html().await.contains(expected)
            {
                return true;
            }
        }
        panic!("event stream closed before the JavaScript update");
    })
    .await
    .ok()
}
