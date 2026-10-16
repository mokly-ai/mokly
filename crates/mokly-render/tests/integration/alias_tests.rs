//! JavaScript and CSS aliases use the configuration directory's package copy.

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
fn javascript_and_css_aliases_select_the_configuration_package() {
    let consumer = Consumer::new();
    fs::write(consumer.root().join("package.json"), r#"{"private":true}"#).unwrap();
    let package = consumer
        .root()
        .join("app/node_modules/fixture-config-theme");
    fs::create_dir_all(&package).unwrap();
    fs::write(
        package.join("package.json"),
        r#"{"name":"fixture-config-theme","main":"index.mjs"}"#,
    )
    .unwrap();
    fs::write(
        package.join("index.mjs"),
        "export const label = 'Configuration theme';",
    )
    .unwrap();
    fs::write(
        package.join("skin.css"),
        ".configuration-theme { color: red }",
    )
    .unwrap();
    fs::write(
        consumer.root().join("app/mokly.config.json"),
        r#"{
      "repoRoot":"..","roots":[{"dir":"../specs"}],
      "renderer":"../renderer.tsx","postcss":"../postcss.mjs",
      "moduleResolution":{"aliases":{"theme-alias":"fixture-config-theme"},"packageRoots":[".."]}
    }"#,
    )
    .unwrap();
    fs::write(
        consumer.root().join("specs/alias.css"),
        "@import 'theme-alias/skin.css';",
    )
    .unwrap();
    consumer.replace(
        "specs/screen.mockup.tsx",
        "import { chip }",
        "import { label } from 'theme-alias';\nimport './alias.css';\nimport { chip }",
    );
    consumer.replace(
        "specs/screen.mockup.tsx",
        "<h1>{props.label}</h1>",
        "<h1>{label}</h1>",
    );
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
    assert!(
        prepared
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .modules
            .contains_key("app/node_modules/fixture-config-theme/index.mjs")
    );
    let factory: &dyn GraphFactory = consumer.runtime.as_ref();
    let generation = factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap();
    let html = generation.render("screen/index.mobile.html").unwrap();
    let CatalogueUsage::Ready { instances, .. } = &html.document.as_ref().unwrap().usage else {
        panic!("component usage must be ready")
    };
    assert_eq!(
        instances[0].source.as_ref().unwrap().path,
        "specs/screen.mockup.tsx"
    );
    assert!(
        String::from_utf8(html.bytes.clone())
            .unwrap()
            .contains("<h1>Configuration theme</h1>")
    );
    let mut styles = String::new();
    for route in generation
        .resource_routes()
        .into_iter()
        .filter(|route| route.ends_with(".css"))
    {
        styles.push_str(&String::from_utf8(generation.resource(&route).unwrap().unwrap()).unwrap());
    }
    assert!(styles.contains(".configuration-theme"), "{styles}");
}
