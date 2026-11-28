//! Preview-only stylesheet edits are watched and move the owning stories' documents.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use mokly_model::output::validation::MARKER;

use super::render_key_tests::{consumer, keys, moved};
use super::support::{Consumer, workspace};

#[test]
fn a_preview_stylesheet_edit_moves_only_its_stories_and_watches_nested_css() {
    for vite in [false, true] {
        let mut fixture = consumer();
        fixture.runtime = Arc::new((*fixture.runtime).clone().with_stylesheet_watching());
        fixture.write(
            "mokly.config.json",
            &format!(
                r#"{{
                    "vite":{vite},
                    "renderer":"renderer.tsx",
                    "roots":[
                        {{"dir":"specs"}},
                        {{"dir":"packages/ui/specs","storybook":"packages/ui/.storybook"}}
                    ]
                }}"#,
            ),
        );
        fixture.write(
            ".storybook/preview.tsx",
            "import './theme.css'; export default {};",
        );
        fixture.write(".storybook/theme.css", "@import './tokens.css';");
        fixture.write(".storybook/tokens.css", ".label {color: teal}");
        fixture.write(
            "packages/ui/.storybook/preview.tsx",
            "import './theme.css'; export default {};",
        );
        fixture.write("packages/ui/.storybook/theme.css", ".other {color: blue}");
        fixture.write(
            "packages/ui/specs/other.stories.tsx",
            "export default { render: () => <p>Other preview</p> }; export const Primary = {};",
        );
        let generation = fixture.generation(fixture.prepare().unwrap());
        assert!(
            generation
                .stylesheet_resolution_files()
                .contains(".storybook/tokens.css"),
            "Vite={vite}: {:?}",
            generation.stylesheet_resolution_files()
        );
        let before = keys(&fixture);
        fixture.write(".storybook/tokens.css", ".label {color: maroon}");
        let after = keys(&fixture);
        assert_eq!(
            moved(&before, &after),
            BTreeSet::from(["label".into(), "label/Secondary".into()]),
            "Vite={vite}",
        );
    }
}

#[test]
fn a_build_with_preview_css_and_a_javascript_image_writes_only_public_paths() {
    let fixture = Consumer::single();
    fixture.write(
        "mokly.config.json",
        r#"{"roots":[{"dir":"specs","files":["**/*.stories.tsx"]}]}"#,
    );
    fixture.write(
        ".storybook/preview.tsx",
        r#"
import './theme.css';
import icon from './icon.svg';
export const decorators = [(Story) => <div><img src={icon} alt="Icon" /><Story /></div>];
"#,
    );
    fixture.write(".storybook/theme.css", "p {color: teal}");
    let image = r#"<svg xmlns="http://www.w3.org/2000/svg"></svg>"#;
    fixture.write(".storybook/icon.svg", image);
    let result = Command::new("node")
        .arg(workspace().join("packages/mokly/bin/mokly.mjs"))
        .args(["build", "--no-changes", "--strict", "--out=.context/site"])
        .current_dir(fixture.root())
        .env("MOKLY_OUTPUT", "plain")
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let output = fixture.root().join(".context/site");
    let generated = output.join("static/mokly-generated");
    assert_eq!(
        fs::read_to_string(generated.join("styles/dot-storybook/preview.tsx.css")).unwrap(),
        "p {\n  color: teal;\n}\n",
    );
    assert_eq!(
        fs::read_to_string(generated.join("assets/dot-storybook/icon.svg")).unwrap(),
        image,
    );
    let document = fs::read_to_string(generated.join("story/index.mobile.html")).unwrap();
    assert!(document.contains("src=\"../assets/dot-storybook/icon.svg\""));
    assert!(output.join(MARKER).is_file());
    assert_public_paths(&output, &output);
}

fn assert_public_paths(output: &Path, directory: &Path) {
    for entry in fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path != output.join(MARKER) {
            assert!(
                !entry.file_name().to_string_lossy().starts_with('.'),
                "{}",
                path.display()
            );
        }
        if entry.file_type().unwrap().is_dir() {
            assert_public_paths(output, &path);
        }
    }
}
