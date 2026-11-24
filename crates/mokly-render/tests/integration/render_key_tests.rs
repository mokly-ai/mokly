//! A JavaScript edit moves exactly the document keys whose render inputs changed.

use std::collections::BTreeSet;
use std::fs;

pub(super) use self::fixture::{consumer, dependency, keys, moved, render_calls};
use super::support::Consumer;

mod fixture;

#[test]
fn equal_catalogues_in_two_checkout_folders_share_render_input_keys() {
    let first = consumer();
    let second = consumer();
    assert_eq!(keys(&first), keys(&second));
}

/// A labelled fixture edit and the entries whose documents it must move.
type Step = (&'static str, Box<dyn Fn(&Consumer)>, Vec<&'static str>);

fn entries(paths: &[&str]) -> BTreeSet<String> {
    paths.iter().map(|path| (*path).to_owned()).collect()
}

fn append(consumer: &Consumer, path: &str, text: &str) {
    let original = std::fs::read_to_string(consumer.root().join(path)).unwrap();
    consumer.write(path, &format!("{original}{text}"));
}

#[test]
fn each_edit_moves_exactly_the_documents_of_its_render_inputs() {
    let consumer = consumer();
    let every_javascript = [
        "c",
        "c/filled",
        "html",
        "label",
        "label/Secondary",
        "p",
        "s/s",
        "t/t",
        "u/u",
    ];
    let steps: [Step; 10] = [
        (
            "module edit",
            Box::new(|c| append(c, "specs/h.ts", "// edit\n")),
            vec!["s/s"],
        ),
        (
            "dependency upgrade",
            Box::new(|c| dependency(c, "2.0.0", "dep-2")),
            vec!["c", "c/filled", "html", "s/s"],
        ),
        (
            "resolution file beside S",
            Box::new(|c| c.write("specs/s/tsconfig.json", "{}\n")),
            vec!["s/s"],
        ),
        (
            "root resolution file",
            Box::new(|c| c.replace("package.json", "\"private\": true", "\"private\": false")),
            every_javascript.to_vec(),
        ),
        (
            "preview edit",
            Box::new(|c| c.replace(".storybook/preview.tsx", "\"one\"", "\"two\"")),
            vec!["label", "label/Secondary"],
        ),
        (
            "class map change",
            Box::new(|c| append(c, "specs/c.module.css", ".extra {\n  color: green;\n}\n")),
            vec!["c", "c/filled", "html", "s/s"],
        ),
        (
            "slot provider edit",
            Box::new(|c| c.replace("specs/p.mockup.tsx", "<i>P</i>", "<i>P2</i>")),
            vec!["c", "c/filled", "html", "p", "s/s"],
        ),
        (
            "renderer edit",
            Box::new(|c| c.replace("theme.ts", "\"plain\"", "\"dark\"")),
            vec!["c", "c/filled", "html", "p", "s/s", "t/t", "u/u"],
        ),
        (
            "add imported PNG",
            Box::new(|consumer| {
                fs::write(
                    consumer.root().join("specs/image.png"),
                    b"\x89PNG\r\n\x1a\n\x01",
                )
                .unwrap();
                consumer.write(
                    "specs/h.ts",
                    "import image from \"./image.png\";\nexport const greeting = image;\n",
                );
            }),
            vec!["s/s"],
        ),
        (
            "edit imported PNG bytes",
            Box::new(|consumer| {
                fs::write(
                    consumer.root().join("specs/image.png"),
                    b"\x89PNG\r\n\x1a\n\x02",
                )
                .unwrap();
            }),
            vec!["s/s"],
        ),
    ];
    let mut before = keys(&consumer);
    for (label, edit, expected) in steps {
        edit(&consumer);
        let after = keys(&consumer);
        assert_eq!(moved(&before, &after), entries(&expected), "{label}");
        before = after;
    }
}

#[test]
fn a_vite_module_edit_moves_only_the_documents_that_import_it() {
    let consumer = consumer();
    consumer.replace(
        "mokly.config.json",
        "\"roots\":",
        "\"vite\": true,\n  \"roots\":",
    );
    consumer.write(
        "vite.config.ts",
        "import react from '@vitejs/plugin-react'; export default { plugins: [react()] };\n",
    );
    let before = keys(&consumer);
    append(&consumer, "specs/h.ts", "// edit\n");
    assert_eq!(moved(&before, &keys(&consumer)), entries(&["s/s"]));
}

#[test]
fn vite_sides_with_different_plugin_inputs_move_every_javascript_key() {
    let head = consumer();
    let base = consumer();
    for side in [&head, &base] {
        side.replace(
            "mokly.config.json",
            "\"roots\":",
            "\"vite\": true,\n  \"roots\":",
        );
        side.replace(
            "specs/t/t.mockup.tsx",
            "<main>T</main>",
            "<main>{\"__PLUGIN__\"}</main>",
        );
        side.write(
            "vite.config.ts",
            include_str!("../../../../tests/fixtures/vite_render_key_config.ts"),
        );
    }
    let before = keys(&base);
    assert_eq!(keys(&head), before);
    head.replace("specs/h.ts", "Hello", "After");
    assert_eq!(
        moved(&before, &keys(&head)),
        entries(&[
            "c",
            "c/filled",
            "html",
            "label",
            "label/Secondary",
            "p",
            "s/s",
            "t/t",
            "u/u"
        ])
    );
}

#[test]
fn a_rebuild_renders_again_only_the_views_whose_render_inputs_moved() {
    let consumer = consumer();
    let render_all = |consumer: &Consumer| {
        let generation = consumer.generation(consumer.prepare().unwrap());
        for route in generation.plans().keys() {
            generation.render(route).unwrap();
        }
    };
    render_all(&consumer);
    let warm = render_calls(&consumer).len();
    append(&consumer, "specs/h.ts", "// edit\n");
    render_all(&consumer);
    let after_module_edit = render_calls(&consumer).split_off(warm);
    assert_eq!(
        after_module_edit,
        [
            ("s/s".to_owned(), "desktop".to_owned()),
            ("s/s".to_owned(), "mobile".to_owned())
        ]
    );
    let before_stylesheet = keys(&consumer);
    let calls = render_calls(&consumer).len();
    consumer.replace("specs/u/u.css", "blue", "green");
    render_all(&consumer);
    assert_eq!(render_calls(&consumer).split_off(calls), []);
    assert_eq!(
        moved(&before_stylesheet, &keys(&consumer)),
        entries(&["u/u"])
    );
    // A path change moves every JavaScript document key through the routing table,
    // but only the renamed target and the screen that links to it render again.
    let calls = render_calls(&consumer).len();
    consumer.replace(
        "specs/t/t.mockup.tsx",
        "title: \"T\",",
        "title: \"T\",\n  path: \"moved\",",
    );
    render_all(&consumer);
    let after_rename: BTreeSet<_> = render_calls(&consumer)
        .split_off(calls)
        .into_iter()
        .collect();
    let expected: BTreeSet<_> = ["moved", "s/s"]
        .into_iter()
        .flat_map(|path| ["desktop", "mobile"].map(|view| (path.to_owned(), view.to_owned())))
        .collect();
    assert_eq!(after_rename, expected);
}

#[test]
fn moving_a_re_exporting_module_renders_the_screens_that_import_its_declaration_again() {
    let consumer = consumer();
    consumer.write(
        "specs/kit/badge.mokly.tsx",
        "import { defineComponent } from \"@mokly/mokly\";\n\nexport const badge = defineComponent({\n  element: \"app-badge\",\n  title: \"Badge\",\n  description: \"Badge.\",\n  relatedDocs: [],\n  propSchema: { type: \"object\", additionalProperties: false, properties: {} } as const,\n  props: {},\n  render: () => <span>Badge</span>,\n});\n",
    );
    consumer.write(
        "specs/kit/badge.mockup.tsx",
        "export { badge } from \"./badge.mokly.js\";\n",
    );
    consumer.write(
        "specs/board/board.mockup.tsx",
        "import { defineScreen } from \"@mokly/mokly\";\n\nimport { badge } from \"../kit/badge.mokly.js\";\n\nexport const board = defineScreen({\n  title: \"Board\",\n  description: \"Board.\",\n  relatedDocs: [],\n  props: {},\n  render: () => (\n    <main>\n      <badge.Component />\n    </main>\n  ),\n});\n",
    );
    let first = consumer.generation(consumer.prepare().unwrap());
    first.render("board/board/index.mobile.html").unwrap();
    std::fs::remove_file(consumer.root().join("specs/kit/badge.mockup.tsx")).unwrap();
    consumer.write(
        "specs/moved/badge.mockup.tsx",
        "export { badge } from \"../kit/badge.mokly.js\";\n",
    );
    let calls = render_calls(&consumer).len();
    let second = consumer.generation(consumer.prepare().unwrap());
    second.render("board/board/index.mobile.html").unwrap();
    assert_eq!(
        render_calls(&consumer).split_off(calls),
        [("board/board".to_owned(), "mobile".to_owned())]
    );
}
