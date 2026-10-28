//! Render input keys stay exact for inputs that no closure module names.

use std::collections::BTreeSet;
use std::fs;

use super::render_key_tests::{consumer, keys, moved, render_calls};
use super::support::{Consumer, link_directory};

/// An installed package that declares Badge through the unattributed API.
fn kit(consumer: &Consumer) {
    consumer.write(
        "specs/node_modules/kit/package.json",
        r#"{ "name": "kit", "type": "module", "main": "index.js" }"#,
    );
    consumer.write(
        "specs/node_modules/kit/index.js",
        "import { defineComponent } from \"@mokly/mokly\";\n\nexport const badge = defineComponent({\n  element: \"app-badge\",\n  title: \"Badge\",\n  description: \"Badge.\",\n  relatedDocs: [],\n  propSchema: { type: \"object\", additionalProperties: false, properties: {} },\n  props: {},\n  render: () => \"Badge\",\n});\n",
    );
}

#[test]
fn moving_the_re_export_of_an_installed_definition_renders_its_importers_again() {
    let consumer = consumer();
    kit(&consumer);
    consumer.write(
        "specs/kit/badge.mockup.tsx",
        "export { badge } from \"kit\";\n",
    );
    consumer.write(
        "specs/board/board.mockup.tsx",
        "import { defineScreen } from \"@mokly/mokly\";\nimport { badge } from \"kit\";\n\nexport const board = defineScreen({\n  title: \"Board\",\n  description: \"Board.\",\n  relatedDocs: [],\n  props: {},\n  render: () => (\n    <main>\n      <badge.Component />\n    </main>\n  ),\n});\n",
    );
    let first = consumer.generation(consumer.prepare().unwrap());
    first.render("board/board/index.mobile.html").unwrap();
    fs::remove_file(consumer.root().join("specs/kit/badge.mockup.tsx")).unwrap();
    consumer.write(
        "specs/moved/badge.mockup.tsx",
        "export { badge } from \"kit\";\n",
    );
    let calls = render_calls(&consumer).len();
    let second = consumer.generation(consumer.prepare().unwrap());
    second.render("board/board/index.mobile.html").unwrap();
    assert_eq!(
        render_calls(&consumer).split_off(calls),
        [("board/board".to_owned(), "mobile".to_owned())]
    );
}

#[test]
fn an_edit_to_a_linked_preview_moves_only_the_story_keys() {
    let consumer = consumer();
    let root = consumer.root().to_path_buf();
    fs::rename(root.join(".storybook"), root.join("storybook")).unwrap();
    link_directory(&root.join("storybook"), &root.join(".storybook"));
    let before = keys(&consumer);
    consumer.replace(".storybook/preview.tsx", "\"one\"", "\"two\"");
    let expected: BTreeSet<_> = ["label", "label/Primary"]
        .into_iter()
        .map(str::to_owned)
        .collect();
    assert_eq!(moved(&before, &keys(&consumer)), expected);
}
