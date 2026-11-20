//! A CSS-only package manifest edit publishes new CSS in the same Serve session.

use std::fs;
use std::time::{Duration, Instant};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use super::support::{Serve, get, write};

const BEFORE: &str = ".before {\n  --selection: before;\n}\n";
const AFTER: &str = ".after {\n  --selection: after;\n}\n";
const CSS_ROUTE: &str = "/static/mokly-generated/styles/theme.css";

#[tokio::test]
async fn css_only_package_style_edit_publishes_the_new_stylesheet() {
    let started = Instant::now();
    let mut serve = Serve::options("", "1", "rich", &|root, _| {
        fs::remove_file(root.join("specs/home.mockup.tsx")).unwrap();
        fs::remove_file(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join("node_modules/fixture-theme")).unwrap();
        write(
            &root.join("node_modules/fixture-theme/package.json"),
            r#"{"name":"fixture-theme","style":"./before.css"}"#,
        );
        write(&root.join("node_modules/fixture-theme/before.css"), BEFORE);
        write(&root.join("node_modules/fixture-theme/after.css"), AFTER);
        write(
            &root.join("mokly.config.json"),
            r#"{"stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        );
        write(&root.join("theme.css"), "@import 'fixture-theme';\n");
        write(
            &root.join("specs/home.screen.html"),
            "---\ntitle: Home\n---\n<p>Home</p>",
        );
    })
    .await;
    serve.listening().await;
    let first = serve.ready(0, "Home").await;
    assert_eq!(get(&serve.host, CSS_ROUTE).await, BEFORE);

    write(
        &serve.path("node_modules/fixture-theme/package.json"),
        r#"{"name":"fixture-theme","style":"./after.css"}"#,
    );
    let published = tokio::time::timeout(Duration::from_secs(30), async {
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
                && serve.index().await["revision"].as_u64().unwrap()
                    > first["revision"].as_u64().unwrap()
                && get(&serve.host, CSS_ROUTE).await == AFTER
            {
                return AFTER.to_owned();
            }
        }
        panic!("event stream closed before the CSS update");
    })
    .await
    .ok();
    let actual = get(&serve.host, CSS_ROUTE).await;
    serve.stop().await;
    eprintln!(
        "CSS-only package style watch scenario: {:?}",
        started.elapsed()
    );
    assert_eq!(
        published.as_deref(),
        Some(AFTER),
        "package style edit must publish new CSS; current CSS: {actual:?}"
    );
    assert_eq!(actual, AFTER);
}
