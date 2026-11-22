//! Closure fact reuse keeps unavailable targets and replays every observer effect.

use std::collections::BTreeMap;
use std::fs;
use std::sync::{Arc, Mutex};

use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_types::Comparison;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_model::material::digest;

use super::composed::{HOME, generation};
use super::support::{Fixture, attempt, engine, output, request};
use super::unavailable::Unavailable;

#[test]
fn ignored_unavailable_target_appearance_revalidates_its_warning_and_membership() {
    let base = Fixture::new();
    let head = Fixture::new();
    base.write("specs/home.screen.html", HOME);
    head.write("specs/home.screen.html", HOME);
    let previous = engine().capture_base(generation(&base, None)).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let initial = attempt(&store);
    let unavailable = Arc::new(Unavailable {
        paths: BTreeMap::from([("icon.svg".into(), "icon checkout unavailable".into())]),
    });
    {
        let first = initial
            .compare_prepared(
                &request(),
                previous.clone(),
                generation(&head, Some(unavailable)),
            )
            .unwrap();
        assert_eq!(
            first
                .after
                .render_all()
                .unwrap()
                .warnings
                .iter()
                .map(|warning| warning.message.as_str())
                .collect::<Vec<_>>(),
            ["icon checkout unavailable"]
        );
    }
    initial.accept();
    let reused = attempt(&store);
    let current = generation(&head, None);
    let result = reused
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!(
        current.public_files().into_iter().collect::<Vec<_>>(),
        ["icon.svg"]
    );
    assert_eq!(current.render_all().unwrap().warnings, []);
    assert_eq!(
        reused.work().validation_walks,
        2,
        "unavailable proof inputs are ordinary misses"
    );
    assert_eq!(
        reused.work().validation_reused,
        2,
        "other views can still reuse closure facts"
    );
    let full = engine()
        .compare_prepared(&request(), previous, generation(&head, None))
        .unwrap();
    assert_eq!(output(&result), output(&full));
}

#[derive(Default)]
struct Watcher(Mutex<Vec<String>>);

impl ResourceObserver for Watcher {
    fn observe(&self, _generation: &str, path: &str) {
        self.0.lock().unwrap().push(path.into());
    }
}

#[test]
fn restored_entry_replays_watch_targets_and_recipe_inputs_after_unaccepted_removal() {
    let base = Fixture::new();
    let head = Fixture::new();
    base.write("specs/home.screen.html", HOME);
    head.write("specs/home.screen.html", HOME);
    let previous = engine().capture_base(generation(&base, None)).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let initial = attempt(&store);
    initial
        .compare_prepared(&request(), previous.clone(), generation(&head, None))
        .unwrap();
    initial.accept();
    fs::remove_file(head.root.path().join("specs/home.screen.html")).unwrap();
    let removal = attempt(&store);
    removal
        .compare_prepared(&request(), previous.clone(), generation(&head, None))
        .unwrap();
    removal.discard();
    head.write("specs/home.screen.html", HOME);
    let current = generation(&head, None);
    assert_eq!(
        current.watch_files().into_iter().collect::<Vec<_>>(),
        Vec::<String>::new()
    );
    let watcher = Arc::new(Watcher::default());
    let observer: Arc<dyn ResourceObserver> = watcher.clone();
    current.observe_resources(Arc::downgrade(&observer));
    let restored = attempt(&store);
    let result = restored
        .compare_prepared(&request(), previous, current.clone())
        .unwrap();
    assert_eq!(restored.work().validation_reused, 4);
    assert_eq!(restored.work().validation_walks, 0);
    assert_eq!(
        current.watch_files().into_iter().collect::<Vec<_>>(),
        ["icon.svg"]
    );
    assert_eq!(*watcher.0.lock().unwrap(), ["icon.svg"]);
    let recipe = &current.plans()["home/index.mobile.html"].resource_key;
    assert_eq!(
        head.inputs.resources.paths(recipe),
        BTreeMap::from([(
            "icon.svg".into(),
            Some(digest(b"<svg><title>one</title></svg>"))
        )])
    );
    assert_eq!(result.counts.changes, 0);
}
