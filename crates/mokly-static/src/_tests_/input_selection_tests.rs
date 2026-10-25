//! Membership reads only configured roots and follows the discovery selection rules.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_source_interface::tree::{Child, FileKind, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::fingerprint_walk;
use crate::input_selection::{Selection, verify};

fn config(directory: &str, identity: &str) -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: directory.into(),
            identity: identity.into(),
        }],
    }
}

fn child(name: &str, kind: FileKind) -> Child {
    Child {
        name: name.into(),
        kind,
    }
}

#[test]
fn root_selection_excludes_unrelated_files_and_unreached_repository_trees() {
    let selection = Selection::new(
        &config("/repo/specs", "/repo/specs"),
        &["/repo/specs/site".into()],
    )
    .unwrap();
    let tree = Unimock::new((
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/specs")))
            .returns(Ok(vec![
                child("home.screen.html", FileKind::File),
                child("notes.txt", FileKind::File),
                child("_folder.json", FileKind::File),
                child("nested", FileKind::Directory),
                child("node_modules", FileKind::Directory),
                child("target", FileKind::Directory),
                child(".mokly-export-reservations", FileKind::Directory),
                child("site", FileKind::Directory),
                child("linked", FileKind::Symlink),
                child("pipe.screen.html", FileKind::Other),
            ])),
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/specs/nested")))
            .returns(Ok(vec![
                child("card.component.html", FileKind::File),
                child("unused.png", FileKind::File),
            ])),
    ));
    let paths = fingerprint_walk::capture(&tree, &selection).files;
    assert_eq!(
        paths,
        BTreeSet::from([
            "/repo/specs/home.screen.html".into(),
            "/repo/specs/_folder.json".into(),
            "/repo/specs/nested/card.component.html".into(),
        ])
    );
    assert!(!selection.selected(0, Path::new("/repo/other/_folder.json")));
}

#[test]
fn a_projected_root_keeps_logical_names_and_excludes_physical_output() {
    let selection = Selection::new(
        &config("/repo/specs", "/repo/physical"),
        &["/repo/physical/site".into()],
    )
    .unwrap();
    let tree = Unimock::new(
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/physical")))
            .returns(Ok(vec![
                child("home.screen.html", FileKind::File),
                child("site", FileKind::Directory),
            ])),
    );
    assert_eq!(
        fingerprint_walk::capture(&tree, &selection).files,
        BTreeSet::from(["/repo/specs/home.screen.html".into()]),
    );
}

#[test]
fn an_explicit_root_beneath_a_denied_name_still_participates() {
    let selection = Selection::new(&config("/repo/target", "/repo/target"), &[]).unwrap();
    let tree = Unimock::new(
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/target")))
            .returns(Ok(vec![child("home.screen.html", FileKind::File)])),
    );
    assert_eq!(
        fingerprint_walk::capture(&tree, &selection).files,
        BTreeSet::from(["/repo/target/home.screen.html".into()]),
    );
}

#[test]
fn additions_and_removals_report_the_selected_input() {
    let before = BTreeSet::from(["/repo/specs/home.screen.html".into()]);
    let after = BTreeSet::from([
        "/repo/specs/home.screen.html".into(),
        "/repo/specs/new.screen.html".into(),
    ]);
    for (left, right) in [(&before, &after), (&after, &before)] {
        assert!(matches!(
            verify(left, right),
            Err(Error::InputsChanged { path }) if path == Path::new("/repo/specs/new.screen.html")
        ));
    }
    verify(&before, &before).unwrap();
}

#[test]
fn a_parent_glob_does_not_expand_an_explicit_root_beneath_a_denied_directory() {
    let mut input = config("/repo", "/repo");
    input.roots[0].input.files = Some(vec!["**/*.md".into()]);
    let mut nested = config("/repo/target", "/repo/target");
    nested.roots[0].input.files = Some(vec!["**/*.screen.html".into()]);
    input.roots.extend(nested.roots);
    let selection = Selection::new(&input, &[]).unwrap();
    let tree = Unimock::new((
        SourceTreeMock::children
            .each_call(matching!((path) if *path == Path::new("/repo")))
            .answers(&|_, _| {
                Ok(vec![
                    child("guide.md", FileKind::File),
                    child("target", FileKind::Directory),
                ])
            })
            .n_times(1),
        SourceTreeMock::children
            .each_call(matching!((path) if *path == Path::new("/repo/target")))
            .answers(&|_, _| {
                Ok(vec![
                    child("home.screen.html", FileKind::File),
                    child("unrelated.md", FileKind::File),
                ])
            })
            .n_times(1),
    ));
    assert_eq!(
        fingerprint_walk::capture(&tree, &selection).files,
        BTreeSet::from([
            "/repo/guide.md".into(),
            "/repo/target/home.screen.html".into(),
        ]),
    );
}
