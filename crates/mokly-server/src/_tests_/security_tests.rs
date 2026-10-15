//! Loopback authority and path decoding are independent of IO.

use axum::http::{HeaderMap, HeaderValue};

use super::{authorized, decode, host};

#[test]
fn hosts_need_exact_loopback_names_and_explicit_decimal_ports() {
    for accepted in [
        "localhost:4173",
        "127.0.0.1:65535",
        "localhost:1",
        "127.0.0.1:9999",
    ] {
        let mut headers = HeaderMap::new();
        headers.insert("host", HeaderValue::from_str(accepted).unwrap());
        headers.insert(
            "origin",
            HeaderValue::from_str(&format!("http://{accepted}")).unwrap(),
        );
        headers.insert("x-mokly-render-token", HeaderValue::from_static("secret"));
        assert_eq!(host(&headers), Some(accepted));
        assert!(authorized(&headers, "secret"));
        assert!(!authorized(&headers, "other"));
        headers.insert("origin", HeaderValue::from_static("https://localhost:4173"));
        assert!(!authorized(&headers, "secret"));
    }
    for rejected in [
        "localhost",
        "localhost:0",
        "localhost:01",
        "localhost:65536",
        "localhost:+1",
        "LOCALHOST:1",
        "localhost:1 ",
        "localhost.evil:1",
        "127.1:1",
        "[::1]:1",
        "user@localhost:1",
        "example.com:1",
    ] {
        let mut headers = HeaderMap::new();
        headers.insert("host", HeaderValue::from_str(rejected).unwrap());
        headers.insert(
            "x-forwarded-host",
            HeaderValue::from_static("localhost:4173"),
        );
        assert!(host(&headers).is_none(), "{rejected}");
    }
}

#[test]
fn decoding_rejects_escapes_and_separators_before_resolution() {
    for path in [
        "//static/a",
        "/static//a",
        "/static/../x",
        "/static/%2e%2e/x",
        "/static/a%2fb",
        "/static/a%5cb",
        "/static/%00x",
        "/static/%",
        "/static/%GG",
        "/static/%ff",
        "/static/C%3ax",
    ] {
        assert!(decode(path).is_none(), "{path}");
    }
    assert_eq!(decode("/"), Some(String::new()));
    assert_eq!(
        decode("/view/home/index.html"),
        Some("view/home/index.html".into())
    );
    assert_eq!(decode("/static/a%20b.txt"), Some("static/a b.txt".into()));
}
