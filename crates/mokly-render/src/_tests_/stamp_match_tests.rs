//! A stamp check holds exactly when no input changed, and it stops at the first changed input.

use std::collections::{BTreeMap, BTreeSet};
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

use crate::input_stamp::InputStamp;

use self::State::{Missing, New, Old};

/// The stamped files: two below `node_modules`, then two in the repository.
const FILES: [&str; 4] = [
    "/repo/node_modules/dep/index.js",
    "/repo/node_modules/dep/package.json",
    "/repo/src/app.ts",
    "/repo/src/view.ts",
];
/// The files, then one membership, two assets, one identity, and one directory scan. The new
/// state of the first asset changes its target, and that of the second asset its bytes.
const ENTRIES: usize = FILES.len() + 5;

/// The state of one stamp entry in a tree. Each state gives the entry a different value.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
enum State {
    Old,
    New,
    /// The read fails, or the path projects to no node.
    Missing,
}

/// Each pair of a stamp-time state and a check-time state. The first pair is the default.
const PAIRS: [(State, State); 9] = [
    (Old, Old),
    (Old, New),
    (Old, Missing),
    (New, Old),
    (New, New),
    (New, Missing),
    (Missing, Old),
    (Missing, New),
    (Missing, Missing),
];

/// An in-memory tree that records each digested path in call order.
#[derive(Default)]
struct MemoryTree {
    digests: BTreeMap<PathBuf, String>,
    nodes: BTreeMap<PathBuf, Node>,
    objects: BTreeMap<PathBuf, String>,
    children: BTreeMap<PathBuf, Vec<Child>>,
    digested: Mutex<Vec<PathBuf>>,
}

impl SourceTree for MemoryTree {
    fn file_object(&self, path: &Path) -> Result<Option<String>> {
        Ok(self.objects.get(path).cloned())
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        Ok(self.nodes.get(path).cloned())
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        self.children
            .get(path)
            .cloned()
            .ok_or_else(|| missing(path))
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        Err(missing(path))
    }
    fn digest(&self, path: &Path) -> Result<String> {
        self.digested.lock().unwrap().push(path.into());
        self.digests.get(path).cloned().ok_or_else(|| missing(path))
    }
}

fn missing(path: &Path) -> SourceError {
    SourceError::Io {
        operation: "read",
        path: path.into(),
        source: io::Error::from(ErrorKind::NotFound),
    }
}

fn value<T>(state: State, old: T, new: T) -> Option<T> {
    match state {
        Old => Some(old),
        New => Some(new),
        Missing => None,
    }
}

fn node(identity: &str) -> Node {
    Node {
        identity: identity.into(),
        lexical_kind: FileKind::File,
        kind: FileKind::File,
    }
}

fn child(name: &str, kind: FileKind) -> Child {
    Child {
        name: name.into(),
        kind,
    }
}

/// A tree with each stamp entry in its state. Entries share no path, so each state changes
/// only its own entry.
fn tree(states: [State; ENTRIES]) -> MemoryTree {
    let [.., membership, logo, icon, identity, scan] = states;
    let mut tree = MemoryTree::default();
    for (path, state) in FILES.into_iter().zip(states) {
        if let Some(digest) = value(state, "old", "new") {
            tree.digests.insert(path.into(), digest.into());
        }
    }
    if let Some(added) = value(membership, None, Some("added.ts")) {
        let mut children = vec![
            child("app.ts", FileKind::File),
            child("link.ts", FileKind::Symlink),
            child("nested", FileKind::Directory),
        ];
        children.extend(added.map(|name| child(name, FileKind::File)));
        tree.children.insert("/repo/src".into(), children);
    }
    if let Some(target) = value(logo, "/repo/assets/first.svg", "/repo/assets/second.svg") {
        tree.nodes.insert("/repo/logo.svg".into(), node(target));
        tree.digests.insert(target.into(), "same bytes".into());
    }
    if let Some(bytes) = value(icon, "first bytes", "second bytes") {
        tree.nodes
            .insert("/repo/icon.svg".into(), node("/repo/assets/icon.svg"));
        tree.digests
            .insert("/repo/assets/icon.svg".into(), bytes.into());
    }
    if let Some(object) = value(identity, "device:first", "device:second") {
        tree.nodes
            .insert("/repo/input.txt".into(), node("/repo/input.txt"));
        tree.objects.insert("/repo/input.txt".into(), object.into());
    }
    if let Some(added) = value(scan, None, Some("c.css")) {
        let mut children = vec![
            child("a.css", FileKind::File),
            child("notes.txt", FileKind::File),
            child("nested", FileKind::Directory),
        ];
        children.extend(added.map(|name| child(name, FileKind::File)));
        tree.children.insert("/repo/styles".into(), children);
        let nested = vec![child("b.css", FileKind::File)];
        tree.children.insert("/repo/styles/nested".into(), nested);
    }
    tree
}

/// The stamp of `tree`, which `current` builds from a stamp that holds only the keys.
fn stamp_of(tree: &MemoryTree) -> InputStamp {
    InputStamp {
        memberships: BTreeMap::from([("/repo/src".into(), None)]),
        files: FILES.into_iter().map(|path| (path.into(), None)).collect(),
        assets: BTreeMap::from([
            ("/repo/logo.svg".into(), None),
            ("/repo/icon.svg".into(), None),
        ]),
        identities: BTreeMap::from([("/repo/input.txt".into(), None)]),
        directories: BTreeMap::from([(("/repo/styles".into(), "**/*.css".into()), None)]),
    }
    .current(tree)
}

/// Each assignment of a pair to every entry where at most two entries leave the default.
fn assignments() -> BTreeSet<[usize; ENTRIES]> {
    let mut assignments = BTreeSet::new();
    for first in 0..ENTRIES {
        for second in 0..ENTRIES {
            for first_pair in 0..PAIRS.len() {
                for second_pair in 0..PAIRS.len() {
                    let mut assignment = [0; ENTRIES];
                    assignment[first] = first_pair;
                    assignment[second] = second_pair;
                    assignments.insert(assignment);
                }
            }
        }
    }
    assignments
}

#[test]
fn matches_and_the_full_comparison_hold_exactly_when_no_entry_changed() {
    let assignments = assignments();
    let mut stamps = BTreeMap::new();
    let mut matching = 0;
    for &assignment in &assignments {
        let before = assignment.map(|pair| PAIRS[pair].0);
        let stamp = stamps
            .entry(before)
            .or_insert_with(|| stamp_of(&tree(before)));
        let checked = tree(assignment.map(|pair| PAIRS[pair].1));
        let pairs = assignment.map(|pair| PAIRS[pair]);
        let expected = pairs.iter().all(|(stamped, checked)| stamped == checked);
        assert_eq!(
            (stamp.matches(&checked), stamp.current(&checked) == *stamp),
            (expected, expected),
            "{pairs:?}"
        );
        matching += usize::from(expected);
    }
    assert_eq!((assignments.len(), matching), (2377, 163));
}

#[test]
fn a_changed_repository_file_ends_the_check_before_any_dependency_file_is_read() {
    let stamp = stamp_of(&tree([Old; ENTRIES]));
    let view = FILES.iter().position(|path| *path == "/repo/src/view.ts");
    let mut states = [Old; ENTRIES];
    states[view.unwrap()] = New;
    let checked = tree(states);
    assert!(!stamp.matches(&checked));
    assert_eq!(
        *checked.digested.lock().unwrap(),
        [
            PathBuf::from("/repo/src/app.ts"),
            PathBuf::from("/repo/src/view.ts")
        ]
    );
}
