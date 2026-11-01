//! Base aliases, bare modules, and subpath styles use the selected ancestor installation.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;
use unimock::Unimock;

use super::support::Consumer;

fn package(root: &Path, name: &str, label: &str) {
    let root = root.join("app/node_modules").join(name);
    fs::create_dir_all(&root).unwrap();
    fs::write(root.join("package.json"), format!(r#"{{"name":"{name}","main":"index.mjs","exports":{{".":"./index.mjs","./skin":"./skin.css"}}}}"#)).unwrap();
    fs::write(
        root.join("index.mjs"),
        format!("export const label = '{label}';"),
    )
    .unwrap();
    fs::write(root.join("skin.css"), format!(".{label} {{color:red}}")).unwrap();
}
fn sources(consumer: &Consumer, target: &str) {
    fs::create_dir_all(consumer.root().join("app/specs")).unwrap();
    fs::write(consumer.root().join(".gitignore"), "node_modules/\n").unwrap();
    fs::write(
        consumer.root().join("app/mokly.config.json"),
        format!(
            r#"{{
        "repoRoot":"..","roots":[{{"dir":"specs"}}],
        "moduleResolution":{{"aliases":{{"theme-alias":"{target}"}}}},
        "stylesheets":[{{"match":"**","stylesheets":["style.css"]}}]
    }}"#
        ),
    )
    .unwrap();
    fs::write(
        consumer.root().join("app/style.css"),
        "@import 'theme-alias/skin'; @import 'plain-theme/skin';",
    )
    .unwrap();
    fs::write(consumer.root().join("app/specs/card.mockup.tsx"), r#"
        import {defineComponent} from '@mokly/mokly';
        import {label} from 'theme-alias';
        import {label as plain} from 'plain-theme';
        export const card=defineComponent({title:'Card', description:'', relatedDocs:[],
          props:{}, element:'ui-card', propSchema:{type:'object',additionalProperties:false,properties:{}},
          render:()=> <p>{label}:{plain}</p>});
    "#).unwrap();
}
fn generation(consumer: &Consumer, runtime: Arc<Runtime>) -> Arc<dyn RenderGeneration> {
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
        definitions: runtime.clone(),
    };
    let prepared = builder.prepare(&config, None).unwrap();
    let graph: &dyn GraphFactory = runtime.as_ref();
    graph
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap()
}
fn check(generation: &dyn RenderGeneration, expected: &str, absent: &str) {
    let route = generation
        .plans()
        .keys()
        .find(|route| route.ends_with(".html"))
        .unwrap();
    let document = generation.render(route).unwrap();
    let html = String::from_utf8_lossy(&document.bytes);
    assert!(html.contains(expected), "{html}");
    assert!(!html.contains(absent), "{html}");
    let styles: String = generation
        .resource_routes()
        .iter()
        .filter(|route| route.ends_with(".css"))
        .map(|route| String::from_utf8(generation.resource(route).unwrap().unwrap()).unwrap())
        .collect();
    assert!(
        styles.contains(expected.split(':').next().unwrap()),
        "{styles}"
    );
    assert!(!styles.contains(absent), "{styles}");
}

#[test]
fn base_alias_and_bare_imports_use_the_base_ancestor_copy_for_javascript_and_css() {
    let head = Consumer::new();
    let base = Consumer::new();
    let installed = Consumer::new();
    sources(&head, "head-theme");
    sources(&base, "base-theme");
    package(head.root(), "head-theme", "HeadAlias");
    package(head.root(), "base-theme", "WrongWorkingCopy");
    package(head.root(), "plain-theme", "HeadPlain");
    package(installed.root(), "base-theme", "BaseAlias");
    package(installed.root(), "plain-theme", "BasePlain");
    check(
        generation(&head, head.runtime.clone()).as_ref(),
        "HeadAlias:HeadPlain",
        "BaseAlias",
    );
    assert!(
        head.runtime
            .dependency_usage
            .directories()
            .contains(&"app/node_modules".into())
    );
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        head.runtime.version.clone(),
        Some(Arc::new(BaseSide {
            working_root: head.repository(),
            sources: Arc::new(Lease {
                directory: base.root().into(),
                guard: Box::new(Unimock::new(())),
            }),
            dependencies: Resolved {
                tier: Tier::Installed,
                node_modules: installed.root().join("node_modules"),
                module_resolution: ModuleResolution {
                    aliases: [("theme-alias".into(), "base-theme".into())].into(),
                    package_roots: vec![
                        installed.root().join("app").to_string_lossy().into_owned(),
                        installed.root().to_string_lossy().into_owned(),
                    ],
                    ..Default::default()
                },
                warning: None,
                lease: None,
                repository_roots: vec![head.root().into(), installed.root().into()],
            },
            cache_namespace: None,
            identity: "base".into(),
        })),
    ));
    check(
        generation(&base, runtime).as_ref(),
        "BaseAlias:BasePlain",
        "WrongWorkingCopy",
    );
}

#[test]
fn postcss_only_package_loads_record_the_ancestor_directory() {
    let head = Consumer::new();
    sources(&head, "unused");
    fs::remove_file(head.root().join("app/specs/card.mockup.tsx")).unwrap();
    fs::write(
        head.root().join("app/specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    fs::write(head.root().join("app/style.css"), "p {color:red}").unwrap();
    let config = head.root().join("app/mokly.config.json");
    let text = fs::read_to_string(&config).unwrap().replacen(
        "\"stylesheets\"",
        "\"postcss\":\"postcss.mjs\",\"stylesheets\"",
        1,
    );
    fs::write(config, text).unwrap();
    package(head.root(), "postcss-only", "unused");
    fs::write(head.root().join("app/node_modules/postcss-only/index.mjs"), "export default {postcssPlugin:'fixture',Once(root){root.append({selector:'.processed',nodes:[{prop:'color',value:'blue'}]});}};").unwrap();
    fs::write(
        head.root().join("app/postcss.mjs"),
        "import plugin from 'postcss-only'; export default {plugins:[plugin]};",
    )
    .unwrap();
    let generation = generation(&head, head.runtime.clone());
    generation.render_all().unwrap();
    assert_eq!(
        head.runtime.dependency_usage.directories(),
        ["app/node_modules"]
    );
}
