//! Position trees answer pointer lookups with storage linear in the node count.

use mokly_model::catalogue::SourceLocation;

use crate::yaml;
use crate::yaml_positions::{Positions, ROOT};

fn at(line: usize) -> SourceLocation {
    SourceLocation {
        path: "p.yaml".into(),
        line,
        column: 1,
        export: None,
    }
}

fn line(positions: &Positions, pointer: &str) -> Option<usize> {
    positions.get(pointer).map(|location| location.line)
}

#[test]
fn pointers_resolve_escaped_and_empty_segments() {
    let mut positions = Positions::at(at(1));
    positions.insert("/a~1b/~0/", at(2));
    assert_eq!(line(&positions, ""), Some(1));
    assert_eq!(line(&positions, "/a~1b/~0/"), Some(2));
    assert_eq!(line(&positions, "/a~1b"), None);
    assert_eq!(line(&positions, "/a~1b/~0/x"), None);
    positions.insert("not-a-pointer", at(3));
    assert_eq!(line(&positions, "not-a-pointer"), None);
    assert_eq!(line(&positions, ""), Some(1));
}

#[test]
fn subtrees_and_grafts_copy_locations_below_a_slot() {
    let mut positions = Positions::default();
    positions.insert("/base", at(1));
    positions.insert("/base/0", at(2));
    positions.insert("/base/0/k", at(3));
    positions.insert("/other", at(4));
    let base = positions.child(ROOT, "base");
    let subtree = positions.subtree(base);
    assert_eq!(line(&subtree, ""), Some(1));
    assert_eq!(line(&subtree, "/0/k"), Some(3));
    assert_eq!(line(&subtree, "/other"), None);
    let copy = positions.child(ROOT, "copy");
    positions.graft(copy, &subtree, ROOT);
    assert_eq!(line(&positions, "/copy"), None);
    assert_eq!(line(&positions, "/copy/0"), Some(2));
    assert_eq!(line(&positions, "/copy/0/k"), Some(3));
}

#[test]
fn storage_grows_with_nodes_not_pointer_length() {
    let mut sizes = Vec::new();
    for depth in [1_000, 4_000] {
        let source = format!("{}leaf\n", "- ".repeat(depth));
        let document = yaml::parse(&source, "p.yaml", 1).unwrap();
        let slots = &document.positions.slots;
        let segments: usize = slots
            .iter()
            .flat_map(|slot| slot.children.keys())
            .map(String::len)
            .sum();
        sizes.push((slots.len(), segments));
    }
    assert_eq!(sizes, [(1_001, 1_000), (4_001, 4_000)]);
}
