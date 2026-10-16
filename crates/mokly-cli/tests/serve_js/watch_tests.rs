//! Failed imports repair through the watcher; manual requests retain accepted bindings.

use super::support::{Serve, source, write};

#[tokio::test]
async fn missing_import_repair_manual_rebuild_and_pool_setting_rejection_keep_the_live_state() {
    let mut serve = Serve::start(&source("Initial")).await;
    let first = serve.ready(0, "Initial").await;
    let original = serve.html().await;
    assert!(original.contains("class=\""));
    assert_eq!(serve.evaluations(), 1);
    let marker = serve.log_count();
    serve.key(b"r");
    serve.wait_line(marker, "manual rebuild").await;
    let manual = serve
        .ready(first["revision"].as_u64().unwrap(), "Initial")
        .await;
    assert_eq!(serve.evaluations(), 1);
    assert_eq!(manual["screens"][0]["views"], first["screens"][0]["views"]);
    let marker = serve.log_count();
    let missing = format!(
        "import {{label}} from './missing.ts'; {}",
        source("{label}")
    );
    write(&serve.path("specs/home.mockup.tsx"), &missing);
    serve.wait_line(marker, "The last good catalogue").await;
    assert_eq!(serve.index().await, manual);
    assert_eq!(serve.html().await, original);
    assert_eq!(serve.evaluations(), 1);
    write(
        &serve.path("specs/missing.ts"),
        "export const label = 'Repaired';",
    );
    let repaired = serve
        .ready(manual["revision"].as_u64().unwrap(), "Repaired")
        .await;
    assert_eq!(serve.evaluations(), 2);
    assert!(serve.html().await.contains("class=\""));
    let marker = serve.log_count();
    write(&serve.path("mokly.config.json"), r#"{"repoRoot":".."}"#);
    serve
        .wait_line(marker, "repoRoot changed. Restart Serve")
        .await;
    serve.wait_line(marker, "The last good catalogue").await;
    assert_eq!(serve.index().await, repaired);
    assert_eq!(serve.evaluations(), 2);
    write(&serve.path("mokly.config.json"), "{}");
    let restored = serve
        .ready(repaired["revision"].as_u64().unwrap(), "Repaired")
        .await;
    assert_eq!(restored["deploymentId"], first["deploymentId"]);
    assert_eq!(serve.evaluations(), 2);
    serve.stop().await;
}
