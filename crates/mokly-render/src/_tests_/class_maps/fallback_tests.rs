//! Unsafe batches and trivial work continue through the ordinary serial bundle path.

use std::sync::{Arc, Mutex};
use std::thread;

use unimock::Unimock;

use crate::dependency_usage::UsedDependencies;
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheet_store::StylesheetCache;

use super::support::{attempt, compiled, inner, key, maps, roots, tree, watch};

#[test]
fn nonempty_stores_live_heads_postcss_duplicate_keys_and_one_worker_stay_serial() {
    for scenario in [
        "shared-record",
        "shared-miss",
        "local-record",
        "live-head",
        "postcss",
        "duplicate",
        "one-worker",
        "one-root",
        "empty",
    ] {
        let shared = Arc::new(Mutex::new(StylesheetCache::default()));
        let events = Arc::new(Mutex::new(Vec::new()));
        let calls = Arc::new(Mutex::new(Vec::new()));
        let recorded = calls.clone();
        let caller = thread::current().id();
        let mut roots = roots(2);
        if scenario == "duplicate" {
            roots[1] = roots[0].clone();
        }
        if scenario == "one-root" {
            roots.truncate(1);
        }
        if scenario == "empty" {
            roots.clear();
        }
        let head = Arc::new(Mutex::new(StylesheetCache::default()));
        let compiler = attempt(
            inner(
                Arc::new(move |root, _| {
                    assert_eq!(thread::current().id(), caller, "{scenario}");
                    recorded.lock().unwrap().push(root.path.clone());
                    Ok(compiled(root))
                }),
                Arc::new(UsedDependencies::default()),
                watch(events.clone()),
                scenario != "postcss",
            ),
            if scenario == "empty" {
                Arc::new(Unimock::new(()))
            } else {
                tree(events)
            },
            &shared,
        )
        .with_head(if scenario == "live-head" {
            Arc::downgrade(&head)
        } else {
            Default::default()
        });
        if scenario == "shared-miss" {
            shared.lock().unwrap().reject("other".into());
        }
        if scenario == "shared-record" || scenario == "local-record" {
            let root = &super::support::roots(3)[2];
            mokly_css::types::StylesheetBundler::bundle(&compiler, root).unwrap();
            if scenario == "local-record" {
                *shared.lock().unwrap() = StylesheetCache::default();
            }
            calls.lock().unwrap().clear();
        }
        let result = compiler
            .class_maps(&roots, if scenario == "one-worker" { 1 } else { 4 })
            .unwrap();
        let expected = match scenario {
            "empty" => Default::default(),
            "duplicate" | "one-root" => maps("r0.css"),
            _ => maps("r1.css"),
        };
        assert_eq!(result, expected, "{scenario}");
        let expected_calls = match scenario {
            "empty" => vec![],
            "duplicate" | "one-root" => vec!["r0.css"],
            _ => vec!["r0.css", "r1.css"],
        };
        assert_eq!(*calls.lock().unwrap(), expected_calls, "{scenario}");
        assert!(shared.try_lock().is_ok());
        assert_eq!(
            compiler
                .local
                .lock()
                .unwrap()
                .record(&key(&super::support::roots(1)[0]))
                .is_some(),
            scenario != "empty"
        );
    }
}
