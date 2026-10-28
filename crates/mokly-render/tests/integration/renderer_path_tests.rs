//! A renderer that a configuration names through `..` still moves the keys it renders.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::GraphFactory;
use mokly_sidecar::methods::Call;

use super::render_key_tests::consumer;
use super::support::Consumer;

/// Every document key of the configuration in `app/`, which names `../renderer.tsx`.
fn nested_keys(consumer: &Consumer) -> BTreeMap<String, String> {
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader
        .load(consumer.root(), Some("app/mokly.config.json"))
        .unwrap();
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: consumer.runtime.clone(),
    };
    let prepared = builder.prepare(&config, None).unwrap();
    let factory: &dyn GraphFactory = consumer.runtime.as_ref();
    let generation = factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap();
    generation
        .plans()
        .iter()
        .map(|(route, plan)| (route.clone(), plan.key.0.clone()))
        .collect()
}

#[test]
fn a_renderer_named_through_a_parent_segment_moves_every_screen_key_when_it_changes() {
    let consumer = consumer();
    consumer.write(
        "app/mokly.config.json",
        r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"colorSchemes":["light"],"renderer":"../renderer.tsx"}"#,
    );
    let before = nested_keys(&consumer);
    consumer.replace("theme.ts", "\"plain\"", "\"dark\"");
    let after = nested_keys(&consumer);
    let moved: BTreeSet<_> = before
        .iter()
        .filter(|(route, key)| after.get(*route) != Some(*key))
        .map(|(route, _)| route.rsplit_once("/index.").unwrap().0)
        .collect();
    assert_eq!(
        moved,
        BTreeSet::from(["c", "c/filled", "html", "p", "s/s", "t/t", "u/u"])
    );
}

#[test]
fn a_renderer_named_through_a_parent_segment_keeps_per_entry_keys() {
    let consumer = consumer();
    consumer.write(
        "app/mokly.config.json",
        r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"colorSchemes":["light"],"renderer":"../renderer.tsx"}"#,
    );
    let before = nested_keys(&consumer);
    let module = std::fs::read_to_string(consumer.root().join("specs/h.ts")).unwrap();
    consumer.write("specs/h.ts", &format!("{module}// edit\n"));
    let after = nested_keys(&consumer);
    let moved: BTreeSet<_> = before
        .iter()
        .filter(|(route, key)| after.get(*route) != Some(*key))
        .map(|(route, _)| route.rsplit_once("/index.").unwrap().0)
        .collect();
    assert_eq!(moved, BTreeSet::from(["s/s"]));
    let renderers: BTreeSet<_> = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::Bundle(params) => Some(params.renderer.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(renderers, BTreeSet::from([Some("renderer.tsx".to_owned())]));
}
