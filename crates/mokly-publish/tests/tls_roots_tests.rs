//! Publish can initialize verified TLS when a Linux container has no OS roots.

#[cfg(target_os = "linux")]
#[test]
fn tls_initializes_without_operating_system_certificates() {
    if std::env::var_os("MOKLY_TEST_EMPTY_ROOTS").is_some() {
        assert!(mokly_publish::http::ReqwestHttp::new().is_ok());
        return;
    }
    let empty = tempfile::tempdir().unwrap();
    let certificates = empty.path().join("empty.pem");
    std::fs::write(&certificates, "").unwrap();
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "tls_initializes_without_operating_system_certificates",
            "--nocapture",
        ])
        .env("MOKLY_TEST_EMPTY_ROOTS", "1")
        .env("SSL_CERT_FILE", &certificates)
        .env("SSL_CERT_DIR", empty.path())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
