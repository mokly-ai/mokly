//! A read inventory hints the projections of its undigested modules at once.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_inventory::Inventory;
use crate::postcss_read_inventory::{ModuleDigests, collect};
use crate::side::SideInputs;

#[test]
fn modules_without_a_digest_share_one_projection_hint() {
    let side = SideInputs {
        source_root: "/base".into(),
        repository_roots: vec!["/head".into()],
        dependency_roots: vec!["/install/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        configuration_directory: String::new(),
        module_resolution: ModuleResolution::default(),
        context: "base".into(),
        vite_inputs: None,
    };
    let hints: Arc<Mutex<Vec<Vec<PathBuf>>>> = Arc::default();
    let recorded = hints.clone();
    let tree = Unimock::new((
        SourceTreeMock::hint_projections
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                recorded.lock().unwrap().push(paths.to_vec());
            })),
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
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
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: vec![],
    };
    let evidence = Evidence {
        coverage: "incomplete".into(),
        modules: vec![
            "/base/postcss.mjs".into(),
            "/install/node_modules/plugin/index.mjs".into(),
        ],
        reads: vec![],
    };
    let digests = ModuleDigests::default();
    for _ in 0..2 {
        let result = collect(
            &tree,
            Path::new("/head"),
            &side,
            &inventory,
            &evidence,
            &digests,
        );
        assert_eq!(result.inputs.len(), 2);
    }
    assert_eq!(
        *hints.lock().unwrap(),
        [
            vec![
                PathBuf::from("/head/node_modules/plugin/index.mjs"),
                PathBuf::from("/head/postcss.mjs"),
            ],
            vec![],
        ]
    );
}
