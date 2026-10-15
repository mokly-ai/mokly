//! Class maps, effective entry identity, and transient props stay in the fragment key.

use std::fs;
use std::sync::Arc;

use mokly_graph::cache::MemoryCache;
use mokly_model::data::Props;
use mokly_sidecar::methods::Call;

use super::support::Consumer;

#[test]
fn evicted_styles_keep_the_generation_source_snapshot() {
    let mut consumer = Consumer::new();
    Arc::get_mut(&mut consumer.runtime).unwrap().cache = Arc::new(MemoryCache::new(0));
    let generation = consumer.generation(consumer.prepare().unwrap());
    let route = "styles/specs/components/chip.mockup.tsx.css";
    let original = generation.resource(route).unwrap().unwrap();
    consumer.replace(
        "library/chip.module.css",
        "color: MOKLY_COLOR;",
        "color: red;",
    );
    assert_eq!(generation.resource(route).unwrap().unwrap(), original);
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert_ne!(changed.resource(route).unwrap().unwrap(), original);
}

#[test]
fn temporary_props_reuse_fragments_without_changing_saved_documents() {
    let consumer = Consumer::new();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let route = "screen/index.mobile.html";
    let saved = generation.render(route).unwrap();
    let props: Props = serde_json::from_str(r#"{"label":"Edited"}"#).unwrap();
    let edited = generation.render_props(route, &props).unwrap();
    assert!(
        String::from_utf8(edited.artifact.bytes.clone())
            .unwrap()
            .contains("Edited")
    );
    assert!(edited.closure.files.contains("assets/banner.svg"));
    let count = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter(|call| matches!(call, Call::RenderScreen(_)))
        .count();
    let repeated = generation.render_props(route, &props).unwrap();
    assert_eq!(edited.artifact.bytes, repeated.artifact.bytes);
    assert_eq!(
        consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::RenderScreen(_)))
            .count(),
        count
    );
    assert_eq!(saved.bytes, generation.render(route).unwrap().bytes);
    let invalid: Props = serde_json::from_str(r#"{"label":false}"#).unwrap();
    assert!(generation.render_props(route, &invalid).is_err());
    assert_eq!(
        consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::RenderScreen(_)))
            .count(),
        count
    );
}

#[test]
fn repeated_describe_reuses_maps_and_changed_postcss_maps_replay_the_bundle() {
    let consumer = Consumer::new();
    let first = consumer.prepare().unwrap();
    let generation = first.javascript.generation.clone().unwrap();
    let first = consumer.generation(first);
    let old = first.render("components/chip/index.mobile.html").unwrap();
    let same = consumer.prepare().unwrap();
    assert_eq!(
        same.javascript.generation.as_ref().unwrap().id,
        generation.id
    );
    {
        let calls = consumer.pool.calls.lock().unwrap();
        assert_eq!(
            calls
                .iter()
                .filter(|call| matches!(call, Call::CssModules(_)))
                .count(),
            1
        );
    }
    fs::write(
        consumer.root().join("tokens.json"),
        r#"{"color":"rebeccapurple","className":"changed"}"#,
    )
    .unwrap();
    let changed = consumer.prepare().unwrap();
    let current = changed.javascript.generation.as_ref().unwrap();
    assert_eq!(current.id, generation.id);
    assert_ne!(current.class_maps_digest, generation.class_maps_digest);
    let changed = consumer.generation(changed);
    assert_ne!(
        old.bytes,
        changed
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
    );
    let calls = consumer.pool.calls.lock().unwrap();
    assert_eq!(
        calls
            .iter()
            .filter(|call| matches!(call, Call::CssModules(_)))
            .count(),
        2
    );
    assert!(calls.iter().any(|call| matches!(call, Call::Dispose(_))));
}
