//! Rebuilding JavaScript preserves cold views of the previous generation on one pool.

use std::sync::Arc;

use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::SidecarPool;

use super::support::Consumer;

#[test]
fn javascript_rebuild_keeps_old_uncached_views_on_the_same_pool_and_process() {
    let consumer = Consumer::new();
    let pool: Arc<dyn SidecarPool> = consumer.pool.clone();
    assert!(Arc::ptr_eq(&pool, &consumer.runtime.pool));
    consumer.replace(
        "specs/screen.mockup.tsx",
        "<h1>{props.label}</h1>",
        "<h1>Generation A: {props.label}</h1>",
    );
    let prepared_a = consumer.prepare().unwrap();
    let id_a = prepared_a
        .javascript
        .generation
        .as_ref()
        .unwrap()
        .id
        .clone();
    let generation_a = consumer.generation(prepared_a);
    let html_a = String::from_utf8(
        generation_a
            .render("screen/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html_a.contains("<h1>Generation A: Hello</h1>"), "{html_a}");
    let cold_route = "screen/index.desktop.html";
    let cold_key = &generation_a.plans()[cold_route].key;
    assert!(consumer.runtime.cache.get(cold_key).is_none());

    consumer.replace("specs/screen.mockup.tsx", "Generation A:", "Generation B:");
    let prepared_b = consumer.prepare().unwrap();
    let id_b = prepared_b
        .javascript
        .generation
        .as_ref()
        .unwrap()
        .id
        .clone();
    assert_ne!(id_a, id_b);
    let generation_b = consumer.generation(prepared_b);
    let html_b = String::from_utf8(
        generation_b
            .render("screen/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html_b.contains("<h1>Generation B: Hello</h1>"), "{html_b}");
    assert!(!html_b.contains("Generation A:"));
    assert!(
        consumer.runtime.cache.get(cold_key).is_none(),
        "the old desktop route must still be uncached"
    );

    let old = String::from_utf8(generation_a.render(cold_route).unwrap().bytes.clone()).unwrap();
    assert!(old.contains("<h1>Generation A: Hello</h1>"), "{old}");
    assert!(!old.contains("Generation B:"));
    assert!(old.contains("data-viewport=\"desktop\""));
    assert!(Arc::ptr_eq(&pool, &consumer.runtime.pool));
    let calls = consumer.pool.calls.lock().unwrap();
    let renders: Vec<_> = calls
        .iter()
        .filter_map(|call| match call {
            Call::RenderScreen(render) => {
                Some((render.generation.as_str(), render.viewport.as_str()))
            }
            _ => None,
        })
        .collect();
    assert_eq!(
        renders,
        [(&*id_a, "mobile"), (&*id_b, "mobile"), (&*id_a, "desktop")]
    );
    let hellos = consumer.processes.hellos();
    assert_eq!(
        hellos,
        vec![1],
        "one real process and one hello across both generations"
    );
    println!("Shared pool: 3 screen renders; sidecar hellos per process: {hellos:?}");
}
