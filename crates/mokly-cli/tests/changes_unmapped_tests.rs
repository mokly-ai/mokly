//! Unsupported importer layouts disclose fallback instead of silently selecting another copy.

use std::path::Path;

mod changes_support;
use changes_support::{base, run, run_configured, write};

#[test]
fn imports_outside_the_configuration_and_nested_workspace_dependencies_warn() {
    for nested in [false, true] {
        let config = if nested {
            "mokly.config.json"
        } else {
            "apps/web/mokly.config.json"
        };
        let text = if nested {
            r#"{"roots":[{"dir":"packages/ui"}],"review":{"base":"fixture-base"}}"#
        } else {
            r#"{"repoRoot":"../..","roots":[{"dir":"../../packages/ui"}],"review":{"base":"fixture-base"}}"#
        };
        let root = base(&[
            (config, text),
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
        let message = String::from_utf8_lossy(&result.stderr);
        assert!(message.contains("base dependency lookup"), "{message}");
        assert!(
            message.contains(if nested {
                "packages/ui/node_modules"
            } else {
                "node_modules"
            }),
            "{message}"
        );
        assert!(String::from_utf8_lossy(&result.stdout).contains("Built Mokly to"));
        let rich = run(root.path(), &["build", "--config", config]);
        assert!(
            String::from_utf8_lossy(&rich.stdout).contains("Changes ready"),
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
        assert_eq!(strict.status.code(), Some(1));
        assert!(String::from_utf8_lossy(&strict.stderr).contains("base dependency lookup"));
    }
}
fn package(root: &Path, directory: &str, value: &str) {
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
