//! Dependency scans use mocked files and exact input counts.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_sidecar::results::{Dependency, DependencyKind};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_inventory;

#[test]
fn explicit_inputs_and_directory_globs_keep_aliases_privacy_and_empty_watches() {
    let reads = Arc::new(Mutex::new(Vec::new()));
    let captured = reads.clone();
    let files = BTreeMap::from([
        (
            Path::new("/repo/inputs/one.txt").to_owned(),
            b"one".to_vec(),
        ),
        (
            Path::new("/repo/inputs/.hidden.txt").to_owned(),
            b"hidden".to_vec(),
        ),
        (
            Path::new("/repo/.context/exact.txt").to_owned(),
            b"exact".to_vec(),
        ),
    ]);
    let projected = files.clone();
    let mock = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let kind = if projected.contains_key(path) {
                    Some(FileKind::File)
                } else if [Path::new("/repo/inputs"), Path::new("/repo/empty")].contains(&path) {
                    Some(FileKind::Directory)
                } else {
                    None
                };
                Ok(kind.map(|kind| Node {
                    identity: path.into(),
                    lexical_kind: kind,
                    kind,
                }))
            })),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(if path == Path::new("/repo/inputs") {
                    vec![
                        Child {
                            name: "one.txt".into(),
                            kind: FileKind::File,
                        },
                        Child {
                            name: ".hidden.txt".into(),
                            kind: FileKind::File,
                        },
                        Child {
                            name: "dist".into(),
                            kind: FileKind::Directory,
                        },
                        Child {
                            name: "alias".into(),
                            kind: FileKind::Symlink,
                        },
                    ]
                } else {
                    Vec::new()
                })
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                captured.lock().unwrap().push(path.to_owned());
                Ok(files[path].clone())
            })),
    ));
    let report = |kind, path: &str| Dependency {
        kind,
        path: path.into(),
        plugin: Some("fixture".into()),
        glob: None,
    };
    let inventory = postcss_inventory::collect(
        &mock,
        &mut crate::postcss_scan::Scan::default(),
        Path::new("/repo"),
        Path::new("/repo"),
        "sheet.css",
        vec![
            report(DependencyKind::File, "/outside/missing"),
            report(DependencyKind::File, "/repo/inputs/one.txt"),
            report(DependencyKind::File, "/repo/.context/exact.txt"),
            Dependency {
                glob: Some("**/*.txt".into()),
                ..report(DependencyKind::Directory, "/repo/inputs")
            },
            report(DependencyKind::Directory, "/repo/empty"),
        ],
    )
    .unwrap();
    assert_eq!(inventory.inputs.len(), 3);
    assert!(inventory.inputs.contains_key("inputs/.hidden.txt"));
    assert!(inventory.inputs.contains_key(".context/exact.txt"));
    assert_eq!(inventory.directories.len(), 2);
    assert_eq!(inventory.plugin_inputs["inputs/one.txt"].plugin, "fixture");
    assert_eq!(reads.lock().unwrap().len(), 3);
}
