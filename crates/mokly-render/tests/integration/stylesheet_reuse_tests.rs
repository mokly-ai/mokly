//! Later preparations reuse every unchanged stylesheet, also when each result carries the
//! read evidence of many PostCSS modules.

use std::fs;

use mokly_sidecar::methods::Call;

use super::support::Consumer;

const ROOTS: usize = 64;
const MODULES: usize = 1_000;

/// The source paths of the PostCSS requests so far.
pub(super) fn requests(consumer: &Consumer) -> Vec<String> {
    let calls = consumer.pool.calls.lock().unwrap();
    calls
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.source_path.clone()),
            _ => None,
        })
        .collect()
}

fn screen(index: usize) -> String {
    format!(
        "import {{ defineScreen }} from \"@mokly/mokly\";\n\nimport \"../styles/screen-{index:02}.css\";\n\n\
         export default defineScreen({{\n  title: \"Screen {index:02}\",\n  description: \"A screen.\",\n  \
         relatedDocs: [],\n  props: {{}},\n  render: () => <p className=\"screen-{index:02}\">Screen</p>,\n}});\n"
    )
}

/// `ROOTS` screens, each with its own stylesheet, and a PostCSS configuration that loads
/// `MODULES` installed modules, so each result carries the read evidence of every module.
fn catalogue() -> Consumer {
    let consumer = Consumer::single();
    let root = consumer.root();
    let package = root.join("vendor/node_modules/fixture-modules");
    fs::remove_dir_all(root.join("specs")).unwrap();
    for directory in [root.join("specs"), root.join("styles"), package.join("lib")] {
        fs::create_dir_all(directory).unwrap();
    }
    fs::write(
        root.join("mokly.config.json"),
        r#"{"roots":[{"dir":"specs"}],"postcss":"postcss.mjs"}"#,
    )
    .unwrap();
    let mut index = String::new();
    for module in 0..MODULES {
        let name = format!("module-{module:04}.mjs");
        fs::write(
            package.join("lib").join(&name),
            format!("export default {module};\n"),
        )
        .unwrap();
        index.push_str(&format!("import m{module} from \"./lib/{name}\";\n"));
    }
    let names: Vec<_> = (0..MODULES).map(|module| format!("m{module}")).collect();
    index.push_str(&format!(
        "\nexport default [{}].length;\n",
        names.join(", ")
    ));
    fs::write(package.join("index.mjs"), index).unwrap();
    fs::write(
        root.join("postcss.mjs"),
        "import total from \"./vendor/node_modules/fixture-modules/index.mjs\";\n\n\
         export default {\n  plugins: [{\n    postcssPlugin: \"modules\",\n    \
         Declaration(declaration) {\n      \
         if (declaration.value === \"MODULES\") declaration.value = String(total);\n    },\n  }],\n};\n",
    )
    .unwrap();
    for index in 0..ROOTS {
        fs::write(
            root.join(format!("specs/screen-{index:02}.mockup.tsx")),
            screen(index),
        )
        .unwrap();
        fs::write(
            root.join(format!("styles/screen-{index:02}.css")),
            format!(".screen-{index:02} {{ order: MODULES; }}\n"),
        )
        .unwrap();
    }
    consumer
}

#[test]
fn unchanged_and_javascript_edited_preparations_reuse_every_stylesheet() {
    let consumer = catalogue();
    let first = consumer.generation(consumer.prepare().unwrap());
    let bundled = requests(&consumer).len();
    assert_eq!(bundled, ROOTS);
    let route = "styles/specs/screen-00.mockup.tsx.css";
    let css = first.resource(route).unwrap().unwrap();
    assert!(String::from_utf8_lossy(&css).contains(&format!("order: {MODULES}")));
    let second = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(requests(&consumer).len(), bundled);
    assert_eq!(second.resource(route).unwrap().unwrap(), css);
    consumer.replace("specs/screen-01.mockup.tsx", ">Screen<", ">Edited<");
    let edited = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(requests(&consumer).len(), bundled);
    assert_eq!(edited.resource(route).unwrap().unwrap(), css);
}

#[test]
fn a_stylesheet_edit_bundles_only_the_root_that_imports_it() {
    let consumer = catalogue();
    consumer.generation(consumer.prepare().unwrap());
    let bundled = requests(&consumer).len();
    consumer.replace("styles/screen-02.css", "order", "z-index");
    let edited = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(requests(&consumer)[bundled..], ["styles/screen-02.css"]);
    let css = edited
        .resource("styles/specs/screen-02.mockup.tsx.css")
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&css).contains(&format!("z-index: {MODULES}")));
}
