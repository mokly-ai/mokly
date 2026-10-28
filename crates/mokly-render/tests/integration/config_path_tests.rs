//! Config-relative spellings with dot segments name the files of their normalized paths.

use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_sidecar::methods::Call;

use super::support::Consumer;

const BADGE: &str = r#"import { defineComponent } from "@mokly/mokly";

export const badge = defineComponent({
  element: "app-badge",
  title: "Badge",
  description: "A component that declares a configured stylesheet.",
  relatedDocs: [],
  propSchema: { type: "object", additionalProperties: false, properties: {} } as const,
  props: {},
  stylesheets: ["first.css"],
  render: () => <span className="first">Badge</span>,
});
"#;

/// The generation of the configuration in `app/`, which reaches the fixture through `..`.
fn nested(consumer: &Consumer, config: &str) -> Arc<dyn RenderGeneration> {
    consumer.write("app/mokly.config.json", config);
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
    factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap()
}

fn document(generation: &dyn RenderGeneration, route: &str) -> String {
    String::from_utf8_lossy(&generation.render(route).unwrap().bytes).into_owned()
}

#[test]
fn a_renderer_named_through_a_parent_segment_keeps_its_stylesheet() {
    let consumer = Consumer::new();
    let generation = nested(
        &consumer,
        r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"colorSchemes":["light"],"renderer":"../renderer.tsx","postcss":"../postcss.mjs"}"#,
    );
    assert!(
        generation
            .resource("styles/renderer.tsx.css")
            .unwrap()
            .is_some()
    );
    let screen = document(generation.as_ref(), "screen/index.mobile.html");
    assert!(
        screen.contains(r#"<link rel="stylesheet" href="../styles/renderer.tsx.css">"#),
        "{screen}"
    );
    let renderers: Vec<_> = consumer
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
    assert!(!renderers.is_empty());
    assert!(
        renderers
            .iter()
            .all(|renderer| renderer.as_deref() == Some("renderer.tsx")),
        "{renderers:?}"
    );
}

#[test]
fn a_configured_stylesheet_named_through_a_parent_segment_can_also_be_declared() {
    let consumer = Consumer::new();
    consumer.write("first.css", ".first {\n  color: teal;\n}\n");
    consumer.write("specs/components/badge.mockup.tsx", BADGE);
    consumer.replace(
        "mokly.config.json",
        r#""postcss": "postcss.mjs""#,
        r#""postcss": "postcss.mjs", "stylesheets": [{ "match": "**", "stylesheets": ["sub/../first.css"] }]"#,
    );
    let generation = consumer.generation(consumer.prepare().unwrap());
    let route = generation
        .plans()
        .keys()
        .find(|route| route.contains("badge") && route.ends_with("index.mobile.html"))
        .unwrap()
        .clone();
    let badge = document(generation.as_ref(), &route);
    assert_eq!(badge.matches("styles/first.css\"").count(), 1, "{badge}");
}

#[test]
fn a_postcss_module_named_through_a_parent_segment_reaches_the_sidecar_normalized() {
    let consumer = Consumer::new();
    consumer.replace(
        "mokly.config.json",
        r#""postcss": "postcss.mjs""#,
        r#""postcss": "tools/../postcss.mjs""#,
    );
    let generation = consumer.generation(consumer.prepare().unwrap());
    document(generation.as_ref(), "screen/index.mobile.html");
    let modules: Vec<_> = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.postcss.clone()),
            _ => None,
        })
        .collect();
    assert!(!modules.is_empty());
    assert!(
        modules.iter().all(|module| module == "postcss.mjs"),
        "{modules:?}"
    );
}
