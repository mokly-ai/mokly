//! Undeclared and encoded routes never fall through to the filesystem.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::support;

async fn raw(url: &str, path: &str, host: &str) -> String {
    let mut stream = TcpStream::connect(url.strip_prefix("http://").unwrap())
        .await
        .unwrap();
    stream
        .write_all(
            format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .await
        .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    response
}

#[tokio::test]
async fn namespace_path_attacks_and_foreign_hosts_fail_closed() {
    let harness = support::Harness::new().await;
    let host = harness.url.strip_prefix("http://").unwrap();
    for route in [
        "/view/missing/",
        "http://foreign.test/static/specs/home.screen.html",
        "/mokly-viewer/source.json",
        "/mokly-viewer/diffs/review.json",
        "/mokly-viewer/usage/home.json",
        "/static/specs/home.screen.html",
        "/static/mokly-generated/missing/index.html",
        "/static/../mokly.config.json",
        "/static/%2e%2e/mokly.config.json",
        "/static/%252e%252e/mokly.config.json",
        "/static/a%2fb",
        "/static/a%5cb",
        "/static/%00x",
        "/static/%",
        "/static/%GG",
        "//mokly-viewer/index.json",
        "/static//a",
        "/mokly-viewer/client/../../mokly.config.json",
    ] {
        let response = raw(&harness.url, route, host).await;
        assert!(response.starts_with("HTTP/1.1 404"), "{route}: {response}");
        assert!(
            !response
                .to_lowercase()
                .contains("access-control-allow-origin")
        );
    }
    for host in [
        "evil.test:4173",
        "localhost",
        "localhost:01",
        "localhost:0",
        "localhost:65536",
        "127.1:4173",
        "[::1]:4173",
    ] {
        let response = raw(&harness.url, "/mokly-viewer/index.json", host).await;
        assert!(response.starts_with("HTTP/1.1 403"), "{host}: {response}");
    }
    for host in ["localhost:9999", "127.0.0.1:9999"] {
        let response = raw(&harness.url, "/mokly-viewer/index.json", host).await;
        assert!(response.starts_with("HTTP/1.1 200"), "{host}");
    }
    for route in [
        "/",
        "/mokly-viewer/index.json",
        "/static/mokly-generated/home/index.mobile.html",
    ] {
        let response = harness
            .client
            .post(format!("{}{route}", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 405);
        support::headers(&response);
    }
    harness.close().await;
}

#[cfg(unix)]
#[tokio::test]
async fn public_reads_recheck_bytes_final_files_and_ancestor_symlinks() {
    let harness = support::Harness::new().await;
    let document = harness
        .client
        .get(format!(
            "{}/static/mokly-generated/home/index.mobile.html",
            harness.url
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(document.status(), 200, "{}", document.text().await.unwrap());
    let path = harness.root.path().join("specs/assets/public.svg");
    std::fs::write(&path, "fresh bytes").unwrap();
    let url = format!("{}/static/specs/assets/public.svg", harness.url);
    assert_eq!(
        harness
            .client
            .get(&url)
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap(),
        "fresh bytes"
    );
    std::fs::remove_file(&path).unwrap();
    std::os::unix::fs::symlink(harness.root.path().join("specs/home.screen.html"), &path).unwrap();
    for method in [reqwest::Method::GET, reqwest::Method::HEAD] {
        assert_eq!(
            harness
                .client
                .request(method, &url)
                .send()
                .await
                .unwrap()
                .status(),
            404
        );
    }
    std::fs::remove_file(&path).unwrap();
    std::fs::write(&path, "safe").unwrap();
    let directory = path.parent().unwrap();
    let moved = harness.root.path().join("moved-assets");
    std::fs::rename(directory, &moved).unwrap();
    std::os::unix::fs::symlink(&moved, directory).unwrap();
    for method in [reqwest::Method::GET, reqwest::Method::HEAD] {
        assert_eq!(
            harness
                .client
                .request(method, &url)
                .send()
                .await
                .unwrap()
                .status(),
            404
        );
    }
    harness.close().await;
}
