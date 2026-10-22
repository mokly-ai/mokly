//! Exact dependency reads retain clean identities without inventories or unrelated inputs.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::tree::{Entry, Limits, Mode};
use unimock::{MockFn, Unimock, matching};

use crate::dependency_paths::governing;
use crate::inputs::{InputReader, Inputs, SourceInputs};
use crate::sources::{SourcesMock, TreeIndex};
use crate::working_inputs::{SystemWorkingInputs, WorkingInputs};

fn path(value: &str) -> RepoPath {
    RepoPath::parse(value).unwrap()
}

#[test]
fn governing_paths_cover_used_owners_and_ancestors_once_without_siblings_or_packages() {
    let paths = governing(&[
        "apps/web/node_modules".into(),
        "node_modules".into(),
        "apps/web/node_modules".into(),
        "node_modules/theme/node_modules".into(),
        "../outside/node_modules".into(),
    ])
    .unwrap();
    let mut expected = Vec::new();
    for root in ["", "apps/", "apps/web/"] {
        for name in [
            "package.json",
            "package-lock.json",
            "npm-shrinkwrap.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "bun.lock",
            "bun.lockb",
        ] {
            expected.push(path(&format!("{root}{name}")));
        }
    }
    expected.sort();
    assert_eq!(paths, expected);
    assert!(governing(&[]).unwrap().is_empty());
}

#[test]
fn exact_base_reads_skip_absent_nonregular_and_unrequested_cached_inputs() {
    let wanted = vec![
        path("package.json"),
        path("package-lock.json"),
        path("yarn.lock"),
    ];
    let object = ObjectId::parse(&"a".repeat(40)).unwrap();
    let entries = [
        Entry {
            path: wanted[0].clone(),
            object: object.clone(),
            mode: Mode::File,
            size: 2,
        },
        Entry {
            path: wanted[1].clone(),
            object: object.clone(),
            mode: Mode::Symlink,
            size: 2,
        },
        Entry {
            path: path("unused/package.json"),
            object: object.clone(),
            mode: Mode::File,
            size: 2,
        },
    ];
    let sources = Unimock::new((
        SourcesMock::ensure
            .next_call(matching!(_))
            .answers(&|_, paths| {
                assert_eq!(
                    paths,
                    [
                        path("package.json"),
                        path("package-lock.json"),
                        path("yarn.lock")
                    ]
                );
                Ok(())
            }),
        SourcesMock::index
            .next_call(matching!())
            .returns(Ok(Arc::new(TreeIndex {
                entries: entries
                    .into_iter()
                    .map(|entry| (entry.path.clone(), entry))
                    .collect(),
            }))),
        SourcesMock::read_many
            .next_call(matching!((paths, _) if paths == &[path("package.json")]))
            .returns(Ok(vec![b"{}".to_vec()])),
    ));
    let selected = SourceInputs
        .read_paths(&sources, &wanted, Limits::default())
        .unwrap();
    assert_eq!(
        selected.files,
        BTreeMap::from([(path("package.json"), b"{}".to_vec())])
    );
    assert_eq!(
        selected.objects,
        BTreeMap::from([(path("package.json"), object)])
    );
}

#[test]
fn exact_working_reads_hash_only_changed_inputs_and_preserve_clean_identity() {
    let object = ObjectId::parse(&"a".repeat(40)).unwrap();
    let paths = [
        path("package.json"),
        path("package-lock.json"),
        path("yarn.lock"),
        path("bun.lock"),
    ];
    let base = Inputs {
        files: BTreeMap::from([
            (paths[0].clone(), b"base".to_vec()),
            (paths[1].clone(), b"lock".to_vec()),
            (paths[2].clone(), b"deleted".to_vec()),
        ]),
        objects: paths[..3]
            .iter()
            .map(|path| (path.clone(), object.clone()))
            .collect(),
    };
    let repository = Unimock::new((
        RepositoryMock::working_bytes
            .each_call(matching!(_, _))
            .answers(&|_, input, _| {
                Ok(match input.as_str() {
                    "package.json" => Some(b"base".to_vec()),
                    "package-lock.json" => Some(b"converted".to_vec()),
                    "yarn.lock" => None,
                    "bun.lock" => Some(b"new".to_vec()),
                    unexpected => panic!("unexpected path {unexpected}"),
                })
            })
            .n_times(4),
        RepositoryMock::working_hashes
            .next_call(matching!(_, _))
            .answers(&|_, paths, _| {
                assert_eq!(paths, [path("package-lock.json"), path("bun.lock")]);
                Ok(vec![
                    ObjectId::parse(&"a".repeat(40)).unwrap(),
                    ObjectId::parse(&"b".repeat(40)).unwrap(),
                ])
            }),
    ));
    let selected = SystemWorkingInputs
        .read_paths(&repository, &base, &paths, Limits::default())
        .unwrap();
    assert_eq!(
        selected.files,
        BTreeMap::from([
            (paths[0].clone(), b"base".to_vec()),
            (paths[1].clone(), b"lock".to_vec()),
            (paths[3].clone(), b"new".to_vec())
        ])
    );
    assert_eq!(selected.objects[&paths[1]], object);
    assert_ne!(selected, base);
}

#[test]
fn no_selected_paths_perform_no_source_or_working_io() {
    assert_eq!(
        SourceInputs
            .read_paths(&Unimock::new(()), &[], Limits::default())
            .unwrap(),
        Inputs::default()
    );
    assert_eq!(
        SystemWorkingInputs
            .read_paths(
                &Unimock::new(()),
                &Inputs::default(),
                &[],
                Limits::default()
            )
            .unwrap(),
        Inputs::default()
    );
}
