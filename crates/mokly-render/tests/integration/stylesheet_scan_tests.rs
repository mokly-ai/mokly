//! A Tailwind root reuses its bundle until a file of its scanned directory changes.

use std::fs;

use super::stylesheet_reuse_tests::requests;
use super::support::Consumer;

const ROUTE: &str = "styles/specs/home.mockup.tsx.css";

/// One screen whose stylesheet makes Tailwind utilities for the files in `scanned`.
fn tailwind() -> Consumer {
    let consumer = Consumer::single();
    let root = consumer.root();
    fs::remove_dir_all(root.join("specs")).unwrap();
    for directory in ["specs", "styles", "scanned"] {
        fs::create_dir(root.join(directory)).unwrap();
    }
    fs::write(
        root.join("mokly.config.json"),
        r#"{"roots":[{"dir":"specs"}],"postcss":"postcss.mjs"}"#,
    )
    .unwrap();
    fs::write(
        root.join("postcss.mjs"),
        "import tailwindcss from \"@tailwindcss/postcss\";\n\n\
         export default {\n  plugins: [tailwindcss({ base: import.meta.dirname, optimize: false })],\n};\n",
    )
    .unwrap();
    fs::write(
        root.join("styles/utilities.css"),
        "@import \"tailwindcss/utilities.css\" source(none);\n@source \"../scanned\";\n",
    )
    .unwrap();
    fs::write(
        root.join("specs/home.mockup.tsx"),
        "import { defineScreen } from \"@mokly/mokly\";\n\nimport \"../styles/utilities.css\";\n\n\
         export default defineScreen({\n  title: \"Home\",\n  description: \"A screen.\",\n  \
         relatedDocs: [],\n  props: {},\n  render: () => <p>Home</p>,\n});\n",
    )
    .unwrap();
    fs::write(
        root.join("scanned/first.html"),
        "<p class=\"underline\">First</p>\n",
    )
    .unwrap();
    consumer
}

fn css(consumer: &Consumer) -> String {
    let generation = consumer.generation(consumer.prepare().unwrap());
    String::from_utf8(generation.resource(ROUTE).unwrap().unwrap()).unwrap()
}

#[test]
fn a_new_class_in_a_scanned_file_bundles_the_tailwind_root_again() {
    let consumer = tailwind();
    let first = css(&consumer);
    assert!(first.contains(".underline"), "{first}");
    assert!(!first.contains(".italic"), "{first}");
    let bundled = requests(&consumer);
    assert_eq!(css(&consumer), first);
    assert_eq!(requests(&consumer), bundled);
    fs::write(
        consumer.root().join("scanned/second.html"),
        "<p class=\"italic\">Second</p>\n",
    )
    .unwrap();
    let added = css(&consumer);
    assert!(added.contains(".italic"), "{added}");
    assert_eq!(
        requests(&consumer)[bundled.len()..],
        ["styles/utilities.css"]
    );
}
