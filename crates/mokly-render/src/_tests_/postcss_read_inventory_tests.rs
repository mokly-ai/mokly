//! Read evidence uses selected side roots without extending plugin source protection.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::postcss_evidence::{Coverage, Evidence, Read};
use mokly_source_interface::read_evidence::{ReadBaseline, ReadCoverage};
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_inventory::Inventory;
use crate::postcss_read_inventory::collect;
use crate::side::SideInputs;
use crate::source_paths::SOURCE_INPUT_PREFIX;

#[test]
fn base_modules_use_selected_dependencies_and_undeclared_reads_stay_outside_the_inventory() {
    let side = SideInputs {
        source_root: "/base".into(),
        repository_roots: vec!["/head".into()],
        dependency_roots: vec!["/install/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        configuration_directory: String::new(),
        module_resolution: ModuleResolution::default(),
        context: "base".into(),
    };
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                assert!(path.starts_with("/head"));
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("late".into())),
    ));
    let inventory = Inventory {
        inputs: BTreeMap::from([("tokens.txt".into(), "late".into())]),
        plugin_inputs: BTreeMap::new(),
        directories: vec![],
    };
    let evidence = Evidence {
        coverage: Coverage::Incomplete,
        modules: vec![
            "/base/postcss.mjs".into(),
            "/install/node_modules/plugin/index.mjs".into(),
        ],
        reads: [
            "/base/postcss.mjs",
            "/install/node_modules/plugin/index.mjs",
            "/base/tokens.txt",
            "/base/undeclared.txt",
            "/outside/opaque.txt",
        ]
        .iter()
        .map(|path| Read::WholeFile {
            identity: None,
            path: (*path).into(),
            digest: "observed".into(),
        })
        .collect(),
    };
    let result = collect(&tree, Path::new("/head"), &side, &inventory, &evidence);
    assert_eq!(result.coverage, ReadCoverage::Incomplete);
    assert_eq!(result.inputs.len(), 3);
    for path in [
        "postcss.mjs",
        "node_modules/plugin/index.mjs",
        &format!("{SOURCE_INPUT_PREFIX}tokens.txt"),
    ] {
        assert_eq!(result.inputs[path].len(), 2);
        assert!(result.inputs[path].contains(&ReadBaseline::ObservedWholeFile("observed".into())));
        assert!(result.inputs[path].contains(&ReadBaseline::Late("late".into())));
    }
    assert_eq!(inventory.inputs.len(), 1);
    assert!(inventory.plugin_inputs.is_empty());
}

#[test]
fn module_witnesses_select_the_ancestor_installation_before_repository_relative_names() {
    let side = SideInputs {
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        dependency_roots: vec!["/repo/app/node_modules".into(), "/repo/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        configuration_directory: "app".into(),
        module_resolution: ModuleResolution::default(),
        context: "head".into(),
    };
    let tree = Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
    );
    let evidence = Evidence {
        modules: vec!["/repo/node_modules/plugin/index.js".into()],
        reads: vec![Read::WholeFile {
            identity: None,
            path: "/repo/node_modules/plugin/index.js".into(),
            digest: "old".into(),
        }],
        ..Default::default()
    };
    let inventory = Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: vec![],
    };
    let result = collect(&tree, Path::new("/repo"), &side, &inventory, &evidence);
    assert_eq!(
        result.inputs.keys().collect::<Vec<_>>(),
        vec!["node_modules/.mokly-roots/1/plugin/index.js"]
    );
}

#[test]
fn native_manifest_inventory_has_only_a_late_baseline_without_a_read_receipt() {
    let side = SideInputs {
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        dependency_roots: vec!["/repo/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        configuration_directory: String::new(),
        module_resolution: ModuleResolution::default(),
        context: "head".into(),
    };
    let tree = Unimock::new((
        SourceTreeMock::project
            .next_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("after-native-resolution".into())),
    ));
    let evidence = Evidence {
        modules: vec!["/repo/node_modules/plugin/package.json".into()],
        ..Default::default()
    };
    let inventory = Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    };
    let result = collect(&tree, Path::new("/repo"), &side, &inventory, &evidence);
    assert_eq!(result.coverage, ReadCoverage::Incomplete);
    assert_eq!(
        result.inputs["node_modules/plugin/package.json"],
        BTreeSet::from([ReadBaseline::Late("after-native-resolution".into())])
    );
}
