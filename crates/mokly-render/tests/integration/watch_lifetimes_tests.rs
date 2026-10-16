//! Real worker events verify compilation reuse, failed candidates, and context release.

use std::fs;

use mokly_model::data::Props;
use mokly_sidecar::methods::{Call, Generation, ProcessCss};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::SidecarPool;

use super::support::Consumer;

#[test]
fn changed_class_maps_reuse_compiled_code_and_failed_candidates_release_once() {
    let consumer = Consumer::single();
    let original = consumer.generation(consumer.prepare().unwrap());
    let old = original
        .render("components/chip/index.mobile.html")
        .unwrap();
    assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
    let starts = consumer.processes.count(Operation::PostcssStart);
    assert_eq!(starts, 1);
    fs::write(
        consumer.root().join("tokens.json"),
        r#"{"color":"blue","className":"replacement"}"#,
    )
    .unwrap();
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
    assert_ne!(
        old.bytes,
        changed
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
    );
    assert_eq!(
        consumer.processes.count(Operation::PostcssStart),
        starts + 1
    );
    fs::write(
        consumer.root().join("specs/broken.use-case.yaml"),
        "title: Broken\nsteps: [unknown-screen]\n",
    )
    .unwrap();
    consumer.replace("specs/screen.mockup.tsx", "Hello", "Candidate");
    assert!(consumer.prepare().is_err());
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
    let started = consumer.processes.count(Operation::PostcssStart);
    assert_eq!(
        started,
        starts + 1,
        "equal stylesheet results need no new context"
    );
    let releases = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter(|call| matches!(call, Call::Dispose(_)))
        .count();
    assert_eq!(releases, 1, "only the failed candidate releases its bundle");
    let props: Props = serde_json::from_str(r#"{"label":"Retained"}"#).unwrap();
    let old = original
        .render_props("components/chip/index.mobile.html", &props)
        .unwrap();
    assert!(String::from_utf8_lossy(&old.artifact.bytes).contains("class=\""));
    drop(original);
    consumer.processes.wait_for(Operation::PostcssStop, 1);
    drop(changed);
    consumer
        .processes
        .wait_for(Operation::PostcssStop, starts + 1);
}

#[test]
fn a_new_worker_restores_old_compiled_code_after_sources_change() {
    let consumer = Consumer::single();
    consumer.replace(
        "specs/screen.mockup.tsx",
        "<h1>{props.label}</h1>",
        "<h1>Original: {props.label}</h1>",
    );
    let prepared = consumer.prepare().unwrap();
    let generation = prepared.javascript.generation.as_ref().unwrap().id.clone();
    let original = consumer.generation(prepared);
    consumer.processes.recycle_next();
    consumer
        .pool
        .request(Call::Describe(Generation { generation }))
        .unwrap();
    consumer.replace("specs/screen.mockup.tsx", "Original:", "Replacement:");
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert!(
        String::from_utf8_lossy(&changed.render("screen/index.mobile.html").unwrap().bytes)
            .contains("Replacement: Hello")
    );
    let old = original.render("screen/index.desktop.html").unwrap();
    assert!(String::from_utf8_lossy(&old.bytes).contains("Original: Hello"));
    assert_eq!(consumer.processes.hellos(), vec![1, 1]);
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
}

#[test]
fn one_context_uses_one_worker_and_release_closes_idle_workers() {
    let consumer = Consumer::new();
    let css = ProcessCss {
        repository_roots: vec![],
        context: "affinity-test".into(),
        source_root: consumer.root().display().to_string(),
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "shared.css".into(),
        text: "a { color: MOKLY_COLOR }".into(),
    };
    std::thread::scope(|scope| {
        let mut jobs = Vec::new();
        for _ in 0..4 {
            let pool = consumer.pool.clone();
            let css = css.clone();
            jobs.push(scope.spawn(move || pool.request(Call::ProcessCss(css)).unwrap()));
        }
        for job in jobs {
            assert!(matches!(
                job.join().unwrap(),
                mokly_sidecar::wire::MethodResult::Css(_)
            ));
        }
    });
    assert_eq!(consumer.processes.hellos(), vec![1]);
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 1);
    consumer.pool.release_context("affinity-test");
    consumer.processes.wait_for(Operation::PostcssStop, 1);
    assert_eq!(consumer.processes.count(Operation::Esbuild), 0);
    consumer.pool.shutdown().unwrap();
    consumer.pool.release_context("already-closed");
    assert_eq!(consumer.processes.hellos(), vec![1]);
}

#[test]
fn failed_used_context_and_shutdown_release_each_lifetime_once() {
    let consumer = Consumer::single();
    let original = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 1);
    fs::write(consumer.root().join("tokens.json"), r#"{"color":"blue"}"#).unwrap();
    fs::write(
        consumer.root().join("specs/broken.use-case.yaml"),
        "title: Broken\nsteps: [unknown-screen]\n",
    )
    .unwrap();
    assert!(consumer.prepare().is_err());
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 2);
    consumer.processes.wait_for(Operation::PostcssStop, 1);
    consumer.pool.shutdown().unwrap();
    drop(original);
    let releases: Vec<_> = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::DisposeContext(params) => Some(params.context.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(releases.len(), 2);
    assert_ne!(releases[0], releases[1]);
    assert_eq!(consumer.processes.hellos(), vec![1]);
}
