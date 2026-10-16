//! A free or recycled second sidecar restores compilation before an evaluation-only bundle.

use std::fs;
use std::thread;

use mokly_sidecar::methods::{Call, Generation};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::SidecarPool;

use super::support::Consumer;

#[test]
fn evaluation_changes_reuse_compilation_on_a_recycled_second_sidecar() {
    for configuration in [false, true] {
        let consumer = Consumer::new();
        let prepared = consumer.prepare().unwrap();
        let id = prepared.javascript.generation.as_ref().unwrap().id.clone();
        let original = consumer.generation(prepared);
        let first = original
            .render("components/chip/index.mobile.html")
            .unwrap();
        assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
        let (entered, release) = consumer.processes.hold_next();
        let busy = consumer.pool.clone();
        let request =
            thread::spawn(move || busy.request(Call::Describe(Generation { generation: id })));
        assert_eq!(entered.recv().unwrap(), 0);
        if configuration {
            consumer.replace(
                "mokly.config.json",
                "\"dir\": \"specs\"",
                "\"dir\": \"specs\", \"path\": \"nested\"",
            );
        } else {
            fs::write(
                consumer.root().join("tokens.json"),
                r#"{"color":"blue","className":"replacement"}"#,
            )
            .unwrap();
        }
        consumer.processes.recycle_next();
        let changed = consumer.prepare();
        release.send(()).unwrap();
        request.join().unwrap().unwrap();
        let changed = consumer.generation(changed.unwrap());
        assert!(
            consumer.processes.hellos().len() >= 3,
            "the second slot must start and recycle"
        );
        assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
        if configuration {
            assert!(
                changed
                    .plans()
                    .contains_key("nested/screen/index.mobile.html")
            );
        } else {
            assert_ne!(
                first.bytes,
                changed
                    .render("components/chip/index.mobile.html")
                    .unwrap()
                    .bytes
            );
        }
        assert_eq!(
            first.bytes,
            original
                .render("components/chip/index.mobile.html")
                .unwrap()
                .bytes
        );
    }
}

#[test]
fn class_maps_still_change_when_directory_membership_forces_a_bundle_request() {
    let consumer = Consumer::new();
    let original = consumer.generation(consumer.prepare().unwrap());
    let old = original
        .render("components/chip/index.mobile.html")
        .unwrap();
    fs::write(
        consumer.root().join("tokens.json"),
        r#"{"color":"blue","className":"replacement"}"#,
    )
    .unwrap();
    fs::write(
        consumer.root().join("library/added.txt"),
        "new resolution candidate",
    )
    .unwrap();
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert_ne!(
        old.bytes,
        changed
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
    );
    assert_eq!(
        old.bytes,
        original
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
    let repeated = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(
        changed
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes,
        repeated
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
}
