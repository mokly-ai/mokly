//! New private reads stay inside mapped roots without losing unavailable witnesses.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::postcss_evidence::{self, Evidence, Read};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::read_evidence::{FileIdentity, ReadBaseline};
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_inventory::Inventory;
use crate::postcss_read_inventory::collect;
use crate::side::SideInputs;

#[test]
fn private_reads_reject_escaping_aliases_but_keep_mapped_and_unavailable_witnesses() {
    let side = SideInputs {
        source_root: "/base".into(),
        repository_roots: vec!["/head".into()],
        dependency_roots: vec!["/install/node_modules".into()],
        dependency_aliases: BTreeMap::new(),
        vite_inputs: None,
        configuration_directory: String::new(),
        module_resolution: ModuleResolution::default(),
        context: "base".into(),
    };
    let hashes = Arc::new(Mutex::new(Vec::new()));
    let recorded = hashes.clone();
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let identity = match path {
                    path if path == Path::new("/head/allowed.txt") => "/head/allowed.txt",
                    path if path == Path::new("/head/escape.txt")
                        || path == Path::new("/head/canonical-escape.txt") =>
                    {
                        "/outside/opaque.txt"
                    }
                    path if path == Path::new("/head/node_modules/plugin/settings.txt") => {
                        "/install/node_modules/plugin/settings.txt"
                    }
                    path if path == Path::new("/head/missing.txt") => return Ok(None),
                    path if path == Path::new("/head/failed.txt") => {
                        return Err(SourceError::Changed { path: path.into() });
                    }
                    unexpected => panic!("unexpected projection {}", unexpected.display()),
                };
                Ok(Some(Node {
                    identity: identity.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                recorded.lock().unwrap().push(path.to_owned());
                Ok("late".into())
            })),
    ));
    let inventory = Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    };
    let mut reads: Vec<_> = [
        "/base/allowed.txt",
        "/base/escape.txt",
        "/base/failed.txt",
        "/install/node_modules/plugin/settings.txt",
    ]
    .into_iter()
    .map(|path| Read::WholeFile {
        path: path.into(),
        digest: "observed".into(),
        identity: None,
    })
    .collect();
    reads.push(Read::WholeFile {
        path: "/base/canonical-escape.txt".into(),
        digest: "observed".into(),
        identity: Some(postcss_evidence::FileIdentity {
            object: "outside-object".into(),
            canonical: Some("/outside/opaque.txt".into()),
        }),
    });
    reads.push(Read::ByteRange {
        path: "/base/missing.txt".into(),
        digest: "range".into(),
        offset: 4,
        length: 3,
        eof: false,
        identity: None,
    });
    let evidence = Evidence {
        reads,
        ..Default::default()
    };
    let result = collect(
        &tree,
        Path::new("/head"),
        &side,
        &inventory,
        &evidence,
        &Default::default(),
    );
    eprintln!("private evidence inputs: {:?}", result.inputs.keys());
    eprintln!("private input hashes: {:?}", hashes.lock().unwrap());
    assert_eq!(
        result.inputs.keys().map(String::as_str).collect::<Vec<_>>(),
        [
            "allowed.txt",
            "failed.txt",
            "missing.txt",
            "node_modules/plugin/settings.txt",
        ]
    );
    assert_eq!(
        *hashes.lock().unwrap(),
        [
            Path::new("/head/allowed.txt"),
            Path::new("/install/node_modules/plugin/settings.txt"),
        ]
    );
    for path in ["allowed.txt", "node_modules/plugin/settings.txt"] {
        assert_eq!(result.inputs[path].len(), 2);
        assert!(result.inputs[path].contains(&ReadBaseline::Late("late".into())));
        assert!(result.inputs[path].contains(&ReadBaseline::ObservedWholeFile("observed".into())));
    }
    assert_eq!(
        result.inputs["failed.txt"].iter().collect::<Vec<_>>(),
        [&ReadBaseline::ObservedWholeFile("observed".into())]
    );
    assert_eq!(
        result.inputs["missing.txt"].iter().collect::<Vec<_>>(),
        [&ReadBaseline::ObservedRange {
            offset: 4,
            length: 3,
            eof: false,
            digest: "range".into(),
            identity: None,
        }]
    );
}

#[test]
fn a_base_source_alias_keeps_the_selected_root_name_and_original_descriptor_identity() {
    let side = SideInputs {
        source_root: "/base".into(),
        repository_roots: vec!["/head".into()],
        dependency_roots: vec![
            "/install/app/node_modules".into(),
            "/install/packages".into(),
        ],
        dependency_aliases: BTreeMap::from([
            ("app/node_modules".into(), "node_modules".into()),
            ("node_modules".into(), "node_modules/.mokly-roots/1".into()),
        ]),
        vite_inputs: None,
        configuration_directory: "app".into(),
        module_resolution: ModuleResolution::default(),
        context: "base".into(),
    };
    let tree = Unimock::new((
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
            .answers(&|_, path| {
                Ok(
                    if path == Path::new("/head/node_modules/.mokly-roots/1/workspace/settings.txt")
                    {
                        "base-source".into()
                    } else {
                        "unrelated-head-install".into()
                    },
                )
            }),
    ));
    let inventory = Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    };
    let evidence = Evidence {
        reads: vec![Read::WholeFile {
            path: "/base/node_modules/workspace/settings.txt".into(),
            digest: "base-source".into(),
            identity: Some(postcss_evidence::FileIdentity {
                object: "base-source-object".into(),
                canonical: Some("/base/packages/workspace/settings.txt".into()),
            }),
        }],
        ..Default::default()
    };
    let result = collect(
        &tree,
        Path::new("/head"),
        &side,
        &inventory,
        &evidence,
        &Default::default(),
    );
    assert_eq!(
        result.inputs.keys().map(String::as_str).collect::<Vec<_>>(),
        ["node_modules/.mokly-roots/1/workspace/settings.txt"]
    );
    let versions = &result.inputs["node_modules/.mokly-roots/1/workspace/settings.txt"];
    assert_eq!(versions.len(), 2);
    assert!(versions.contains(&ReadBaseline::Late("base-source".into())));
    assert!(versions.contains(&ReadBaseline::ObservedFile {
        digest: "base-source".into(),
        identity: FileIdentity {
            object: "base-source-object".into(),
            canonical: Some("/base/packages/workspace/settings.txt".into()),
        },
    }));
}
