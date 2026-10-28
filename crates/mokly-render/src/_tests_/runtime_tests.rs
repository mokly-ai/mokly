//! Runtime sides get unique PostCSS contexts and normalized package roots.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ModuleResolution, ResolvedConfig};
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;

fn runtime() -> Runtime {
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "version".into(),
        None,
    )
}

#[test]
fn contexts_are_unique_across_runtime_instances_and_clones() {
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let one = runtime();
    let two = runtime();
    let contexts = [
        one.side(&config).unwrap().context,
        one.clone().side(&config).unwrap().context,
        two.side(&config).unwrap().context,
    ];
    assert_eq!(contexts.into_iter().collect::<BTreeSet<_>>().len(), 3);
}

#[test]
fn package_roots_reach_the_sidecar_in_normalized_form() {
    let config = ResolvedConfig {
        input: Config {
            module_resolution: Some(ModuleResolution {
                package_roots: Some(vec!["../packages/ui".into(), "..".into()]),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/tools/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    assert_eq!(
        runtime()
            .side(&config)
            .unwrap()
            .module_resolution
            .package_roots
            .iter()
            .map(PathBuf::from)
            .collect::<Vec<_>>(),
        // The configured `..` repeats an ancestor, and the head keeps one copy as the
        // base does.
        ["/repo/tools", "/repo", "/repo/packages/ui"].map(PathBuf::from)
    );
}
