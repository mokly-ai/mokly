//! Tracked dependency files use their Git bytes even when tier one selects working installs.

mod changes_support;
use changes_support::{base, git, run, write};

const PAGE: &str = "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head><title>Page</title></head><body><p>'+VALUE+'</p></body></html>'});";

#[test]
fn tier_one_keeps_a_tracked_javascript_dependency_in_the_base_tree() {
    let page = format!(
        "import value from 'fixture-value'; {}",
        PAGE.replace("VALUE", "value")
    );
    let root = base(&[
        (".gitignore", "mokly-static/\n.context/\n"),
        (
            "mokly.config.json",
            r#"{"roots":[{"dir":"src"}],"review":{"base":"fixture-base"}}"#,
        ),
        ("src/page.mockup.ts", &page),
        (
            "src/node_modules/fixture-value/package.json",
            r#"{"name":"fixture-value","main":"index.mjs"}"#,
        ),
        (
            "src/node_modules/fixture-value/index.mjs",
            "export default 'Base value';",
        ),
    ]);
    git(
        root.path(),
        &[
            "ls-files",
            "--error-unmatch",
            "src/node_modules/fixture-value/index.mjs",
        ],
    );
    write(
        root.path(),
        "src/node_modules/fixture-value/index.mjs",
        "export default 'Head value';",
    );
    let result = run(root.path(), &["build", "--strict", "--sidecars", "1"]);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(result.stderr.is_empty());
    assert!(
        String::from_utf8_lossy(&result.stdout).contains("Changes ready · 1 change"),
        "{}",
        String::from_utf8_lossy(&result.stdout)
    );
}

#[test]
fn tier_one_keeps_a_tracked_stylesheet_dependency_in_the_base_tree() {
    let root = base(&[
        (".gitignore", "mokly-static/\n.context/\n"),
        (
            "mokly.config.json",
            r#"{"roots":[{"dir":"src"}],"stylesheets":[{"match":"**","stylesheets":["src/theme.css"]}],"review":{"base":"fixture-base"}}"#,
        ),
        ("src/page.mockup.ts", &PAGE.replace("VALUE", "'Unchanged'")),
        (
            "src/styled.screen.html",
            "---\ntitle: Styled\n---\n<p class=\"fixture\">Styled</p>",
        ),
        ("src/theme.css", "@import 'fixture-value/style.css';"),
        (
            "src/node_modules/fixture-value/package.json",
            r#"{"name":"fixture-value"}"#,
        ),
        (
            "src/node_modules/fixture-value/style.css",
            ".fixture{color:red}",
        ),
    ]);
    git(
        root.path(),
        &[
            "ls-files",
            "--error-unmatch",
            "src/node_modules/fixture-value/style.css",
        ],
    );
    write(
        root.path(),
        "src/node_modules/fixture-value/style.css",
        ".fixture{color:blue}",
    );
    let result = run(root.path(), &["build", "--strict", "--sidecars", "1"]);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(result.stderr.is_empty());
    assert!(
        String::from_utf8_lossy(&result.stdout).contains("Changes ready · 1 change"),
        "{}",
        String::from_utf8_lossy(&result.stdout)
    );
}
