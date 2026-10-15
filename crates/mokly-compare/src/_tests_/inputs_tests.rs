//! Content identities and complete dependency inventory from mocked sources.

use std::collections::BTreeMap;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Limits, Mode};
use unimock::{MockFn, Unimock, matching};

use crate::inputs::{InputReader, Inputs, SourceInputs};
use crate::sources::SourcesMock;

fn inputs(lock: &[u8], manifest: &[u8]) -> Inputs {
    Inputs {
        objects: BTreeMap::new(),
        files: BTreeMap::from([
            (RepoPath::parse("package-lock.json").unwrap(), lock.to_vec()),
            (RepoPath::parse("package.json").unwrap(), manifest.to_vec()),
        ]),
    }
}

#[test]
fn keys_cover_lock_manifest_manager_version_and_local_sources() {
    let a = inputs(b"lock", b"{}");
    assert!(a.supports_npm());
    assert_eq!(a.key("1", "a"), a.key("1", "b"));
    assert_ne!(a.key("1", "a"), a.key("2", "a"));
    assert_ne!(a.key("1", "a"), inputs(b"edit", b"{}").key("1", "a"));
    assert_ne!(
        a.key("1", "a"),
        inputs(b"lock", b"{\"name\":\"edit\"}").key("1", "a")
    );
    let local = inputs(
        b"lock",
        br#"{"dependencies":{"local":"file:packages/local"}}"#,
    );
    assert_ne!(local.key("1", "a"), local.key("1", "b"));
    assert_eq!(
        a.differing_lockfile(&inputs(b"lock", b"changed"), &[])
            .unwrap()
            .as_str(),
        "package-lock.json"
    );
    assert!(!inputs(b"lock", br#"{"packageManager":"pnpm@10"}"#).supports_npm());
}

#[test]
fn inventory_reads_every_workspace_manifest_but_no_dependency_or_source_file() {
    let object = ObjectId::parse(&"a".repeat(40)).unwrap();
    let entries = [
        "package.json",
        "packages/ui/package.json",
        "package-lock.json",
        "specs/file.ts",
        "node_modules/pkg/package.json",
    ]
    .map(|path| Entry {
        path: RepoPath::parse(path).unwrap(),
        object: object.clone(),
        mode: Mode::File,
        size: 2,
    });
    let sources = Unimock::new((
        SourcesMock::list
            .next_call(matching!(_, _))
            .returns(Ok(entries.to_vec())),
        SourcesMock::read_many
            .next_call(matching!((paths, _) if paths.len() == 3))
            .returns(Ok(vec![b"{}".to_vec(), b"{}".to_vec(), b"{}".to_vec()])),
    ));
    let reader: &dyn InputReader = &SourceInputs;
    assert_eq!(
        reader
            .read(&sources, Limits::default())
            .unwrap()
            .files
            .len(),
        3
    );
}

#[test]
fn warning_selects_the_first_differing_lockfile_across_both_path_sets() {
    let base = inputs(b"base", b"{}");
    let mut head = inputs(b"edit", b"{}");
    head.files.insert(
        RepoPath::parse("npm-shrinkwrap.json").unwrap(),
        b"new".to_vec(),
    );
    assert_eq!(
        base.differing_lockfile(&head, &[]).unwrap().as_str(),
        "npm-shrinkwrap.json"
    );
}

#[test]
fn manifest_only_warning_names_the_first_selected_install_roots_lockfile() {
    let mut base = inputs(b"root", b"{}");
    base.files.insert(
        RepoPath::parse("examples/app/package-lock.json").unwrap(),
        b"example".to_vec(),
    );
    base.files.insert(
        RepoPath::parse("frontend/package-lock.json").unwrap(),
        b"front".to_vec(),
    );
    let mut head = base.clone();
    head.files.insert(
        RepoPath::parse("package.json").unwrap(),
        b"changed".to_vec(),
    );
    assert_eq!(
        base.differing_lockfile(&head, &["frontend".into()])
            .unwrap()
            .as_str(),
        "package-lock.json"
    );
    base.files
        .remove(&RepoPath::parse("package-lock.json").unwrap());
    head.files
        .remove(&RepoPath::parse("package-lock.json").unwrap());
    assert_eq!(
        base.differing_lockfile(&head, &["frontend".into()])
            .unwrap()
            .as_str(),
        "frontend/package-lock.json"
    );
    base.files
        .insert(RepoPath::parse("pnpm-lock.yaml").unwrap(), b"pnpm".to_vec());
    head.files
        .insert(RepoPath::parse("pnpm-lock.yaml").unwrap(), b"pnpm".to_vec());
    assert_eq!(
        base.differing_lockfile(&head, &["frontend".into()])
            .unwrap()
            .as_str(),
        "frontend/package-lock.json"
    );
    base.files
        .remove(&RepoPath::parse("pnpm-lock.yaml").unwrap());
    head.files
        .remove(&RepoPath::parse("pnpm-lock.yaml").unwrap());
    assert!(base.differing_lockfile(&head, &[]).is_none());
}
