//! JavaScript-free catalogues never ask the pool to start a process.

use std::fs;

use mokly_sidecar::methods::Call;

use super::support::Consumer;

#[test]
fn html_catalogues_start_no_sidecar_and_css_only_needs_no_bundle() {
    let consumer = Consumer::new();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"roots":[{"dir":"specs","files":["**/*.screen.html"]}]}"#,
    )
    .unwrap();
    fs::write(
        consumer.root().join("specs/mixed.screen.html"),
        "---\ntitle: HTML\n---\n<h1>HTML</h1>",
    )
    .unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(generation.render_all().unwrap().documents, 2);
    assert!(consumer.pool.calls.lock().unwrap().is_empty());
    fs::write(consumer.root().join("mokly.config.json"), r#"{"roots":[{"dir":"specs","files":["**/*.screen.html"]}],"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["shared.css"]}]}"#).unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(generation.render_all().unwrap().documents, 2);
    let calls = consumer.pool.calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert!(matches!(calls[0], Call::ProcessCss(_)));
}
