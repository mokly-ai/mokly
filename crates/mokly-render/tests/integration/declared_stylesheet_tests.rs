//! Declared component stylesheet paths use the configuration path rules.

use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;
use unimock::Unimock;

use super::support::{Consumer, workspace};

const NESTED_CONFIG: &str = r#"{
  "repoRoot": "..",
  "roots": [{"dir": "../specs"}],
  "colorSchemes": ["light"],
  "renderer": "../renderer.tsx",
  "postcss": "../postcss.mjs"
}"#;

fn setup(consumer: &Consumer, declarations: &str, configured: Option<&str>) {
    let config = configured.map_or_else(
        || NESTED_CONFIG.to_owned(),
        |stylesheets| {
            NESTED_CONFIG.replace(
                "\n}",
                &format!(
                    ",\n  \"stylesheets\": [{{\"match\": \"**\", \"stylesheets\": [{stylesheets}]}}]\n}}"
                ),
            )
        },
    );
    consumer.write("app/mokly.config.json", &config);
    consumer.write("styles/declared.css", ".declared { color: teal; }\n");
    consumer.write("styles/other.css", ".other { color: purple; }\n");
    consumer.replace(
        "library/chip.tsx",
        "relatedDocs: [],",
        &format!("relatedDocs: [], stylesheets: [{declarations}],"),
    );
}

fn config(consumer: &Consumer) -> ResolvedConfig {
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    loader
        .load(consumer.root(), Some("app/mokly.config.json"))
        .unwrap()
}

fn prepared(runtime: &Arc<Runtime>, config: &ResolvedConfig) -> PreparedCatalogue {
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: runtime.clone(),
    };
    builder.prepare(config, None).unwrap()
}

fn generation(runtime: Arc<Runtime>, config: ResolvedConfig) -> Arc<dyn RenderGeneration> {
    let prepared = prepared(&runtime, &config);
    let factory: &dyn GraphFactory = runtime.as_ref();
    factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap()
}

fn nested_generation(consumer: &Consumer) -> Arc<dyn RenderGeneration> {
    generation(consumer.runtime.clone(), config(consumer))
}

fn nested_base_generation(head: &Consumer, base: &Consumer) -> Arc<dyn RenderGeneration> {
    let root = workspace();
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        head.runtime.version.clone(),
        Some(Arc::new(BaseSide {
            sources: Arc::new(Lease {
                directory: base.root().into(),
                guard: Box::new(Unimock::new(())),
            }),
            dependencies: Resolved {
                tier: Tier::Working,
                node_modules: root.join("node_modules"),
                module_resolution: ModuleResolution {
                    package_roots: vec![root.to_string_lossy().into_owned()],
                    ..Default::default()
                },
                warning: None,
                lease: None,
                repository_roots: vec![head.root().into(), root],
            },
            identity: "declared-stylesheet-base".into(),
        })),
    ));
    generation(runtime, config(base))
}

fn rendered_component(generation: &dyn RenderGeneration) -> String {
    let route = generation
        .plans()
        .keys()
        .find(|route| route.contains("components/chip") && route.ends_with("index.mobile.html"))
        .unwrap();
    String::from_utf8_lossy(&generation.render(route).unwrap().bytes).into_owned()
}

fn assert_declared_link(generation: &dyn RenderGeneration) -> String {
    let css = generation
        .resource("styles/styles/declared.css")
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&css).contains(".declared"));
    let document = rendered_component(generation);
    assert_eq!(
        document.matches("styles/styles/declared.css\"").count(),
        1,
        "{document}"
    );
    document
}

#[test]
fn parent_segment_declared_stylesheets_link_on_head_and_base() {
    let head = Consumer::new();
    let base = Consumer::new();
    setup(&head, "'../styles/declared.css'", None);
    setup(&base, "'../styles/declared.css'", None);

    assert_declared_link(nested_generation(&head).as_ref());
    assert_declared_link(nested_base_generation(&head, &base).as_ref());
}

#[test]
fn dot_and_empty_declared_stylesheet_segments_link_the_normalized_route() {
    for value in ["../styles/./declared.css", "../styles//declared.css"] {
        let consumer = Consumer::new();
        setup(&consumer, &format!("'{value}'"), None);
        assert_declared_link(nested_generation(&consumer).as_ref());
    }
}

#[test]
fn declared_stylesheet_outside_repo_root_reports_the_authored_value() {
    let consumer = Consumer::new();
    let value = "../../outside.css";
    setup(&consumer, &format!("'{value}'"), None);
    let config = config(&consumer);
    let runtime = consumer.runtime.clone();
    let prepared = prepared(&runtime, &config);
    let factory: &dyn GraphFactory = runtime.as_ref();
    let result = factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None);
    let error = match result {
        Ok(_) => panic!("an outside-repository stylesheet must fail"),
        Err(error) => error,
    };
    let message = error.to_string();
    assert!(message.contains("declares invalid stylesheet"), "{message}");
    assert!(message.contains(value), "{message}");
}

#[test]
fn duplicate_declared_spellings_link_once_and_warn_with_the_first_spelling() {
    let consumer = Consumer::new();
    setup(
        &consumer,
        "'../styles/declared.css', '../styles/./declared.css'",
        None,
    );
    let generation = nested_generation(&consumer);
    assert_declared_link(generation.as_ref());
    let warnings: Vec<_> = generation
        .catalogue()
        .warnings
        .iter()
        .filter(|warning| warning.code == "duplicate-component-stylesheet")
        .collect();
    assert_eq!(warnings.len(), 1);
    assert_eq!(
        warnings[0].message,
        "duplicate component stylesheet \"../styles/declared.css\" is ignored; it is linked once."
    );
}

#[test]
fn configured_and_declared_aliases_link_once_at_the_configured_position() {
    let consumer = Consumer::new();
    setup(
        &consumer,
        "'..//styles/declared.css'",
        Some("\"../styles/./declared.css\", \"../styles/other.css\""),
    );
    let generation = nested_generation(&consumer);
    let document = assert_declared_link(generation.as_ref());
    assert_eq!(document.matches("styles/styles/declared.css\"").count(), 1);
    let other = document.find("styles/styles/other.css\"").unwrap();
    let declared = document.find("styles/styles/declared.css\"").unwrap();
    assert!(declared < other, "{document}");
}
