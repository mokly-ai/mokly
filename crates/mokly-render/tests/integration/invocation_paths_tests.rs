//! Nested config directories keep invocation locations rooted at the repository.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::GraphFactory;
use mokly_model::usage::CatalogueUsage;

use super::support::Consumer;

#[test]
fn nested_example_layout_keeps_repository_relative_invocation_paths() {
    let consumer = Consumer::new();
    let nested = consumer.root().join("examples/basic");
    fs::create_dir_all(&nested).unwrap();
    for entry in fs::read_dir(consumer.root()).unwrap() {
        let entry = entry.unwrap();
        if entry.file_name() != "node_modules" && entry.file_name() != "examples" {
            fs::rename(entry.path(), nested.join(entry.file_name())).unwrap();
        }
    }
    consumer.replace(
        "examples/basic/renderer.tsx",
        "assets/banner.svg",
        "examples/basic/assets/banner.svg",
    );
    let file = nested.join("mokly.config.json");
    fs::write(
        &file,
        r#"{
      "repoRoot":"../..","roots":[{"dir":"specs"}],
      "colorSchemes":["light","dark"],"renderer":"renderer.tsx","postcss":"postcss.mjs"
    }"#,
    )
    .unwrap();
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader
        .load(consumer.root(), Some("examples/basic/mokly.config.json"))
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
    let rendered = generation.render("screen/index.mobile.html").unwrap();
    let CatalogueUsage::Ready { instances, .. } = &rendered.document.as_ref().unwrap().usage else {
        panic!("component usage must be ready")
    };
    assert!(!instances.is_empty());
    assert_eq!(
        instances[0].source.as_ref().unwrap().path,
        "examples/basic/specs/screen.mockup.tsx"
    );
    for instance in instances {
        if let Some(source) = &instance.source {
            assert!(source.path.starts_with("examples/basic/"), "{source:?}");
        }
    }
}
