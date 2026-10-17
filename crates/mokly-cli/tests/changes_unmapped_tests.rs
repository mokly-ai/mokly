//! Per-importer base lookup preserves nested and outside-configuration dependency copies.

use std::path::Path;

mod changes_support;
use changes_support::{base, run, run_configured, write};

#[test]
fn imports_outside_configuration_and_nested_workspace_dependencies_preserve_the_copy() {
    for nested in [false, true] {
        let config = if nested {
            "mokly.config.json"
        } else {
            "apps/web/mokly.config.json"
        };
        let text = if nested {
            r#"{"roots":[{"dir":"packages/ui"}],"stylesheets":[{"match":"**","stylesheets":["packages/ui/theme.css"]}],"review":{"base":"fixture-base"}}"#
        } else {
            r#"{"repoRoot":"../..","roots":[{"dir":"../../packages/ui"}],"stylesheets":[{"match":"**","stylesheets":["../../packages/ui/theme.css"]}],"review":{"base":"fixture-base"}}"#
        };
        let root = base(&[
            (config, text),
            (
                "packages/ui/theme.css",
                "@import 'fixture-version/style.css';",
            ),
            (
                "packages/ui/styled.screen.html",
                "---\ntitle: Styled\n---\n<p class=\"fixture\">Styled</p>",
            ),
            (
                "packages/ui/package.json",
                r#"{"name":"fixture-ui","private":true}"#,
            ),
            ("package.json", r#"{"private":true}"#),
            (
                "packages/ui/home.mockup.ts",
                "import value from 'fixture-version'; import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render:()=> '<!doctype html><html><head><title>Home</title></head><body>'+value+'</body></html>'});",
            ),
        ]);
        package(root.path(), "", "root-v1");
        package(
            root.path(),
            if nested { "packages/ui/" } else { "apps/web/" },
            "near-v2",
        );
        let result = run_configured(
            root.path(),
            &["build", "--config", config],
            None,
            None,
            "plain",
        );
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert!(
            result.stderr.is_empty(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert!(String::from_utf8_lossy(&result.stdout).contains("Built Mokly to"));
        let rich = run(root.path(), &["build", "--config", config]);
        assert!(
            String::from_utf8_lossy(&rich.stdout).contains("Changes ready · 0 changes"),
            "{}",
            String::from_utf8_lossy(&rich.stderr)
        );
        let strict = run_configured(
            root.path(),
            &["build", "--config", config, "--strict"],
            None,
            None,
            "plain",
        );
        assert_eq!(
            strict.status.code(),
            Some(0),
            "{}",
            String::from_utf8_lossy(&strict.stderr)
        );
        assert!(strict.stderr.is_empty());
    }
}
fn package(root: &Path, directory: &str, value: &str) {
    write(
        root,
        &format!("{directory}node_modules/fixture-version/style.css"),
        if value == "root-v1" {
            ".fixture{color:red}"
        } else {
            ".fixture{color:blue}"
        },
    );
    write(
        root,
        &format!("{directory}node_modules/fixture-version/package.json"),
        r#"{"name":"fixture-version","main":"index.mjs"}"#,
    );
    write(
        root,
        &format!("{directory}node_modules/fixture-version/index.mjs"),
        &format!("export default '{value}';"),
    );
}
