//! The recycle measurement includes Node descendants without native helper memory.

use std::collections::BTreeMap;
use std::path::Path;

use crate::process_memory::{Sample, tree_bytes};

fn node(parent: Option<u32>, bytes: u64) -> Sample<'static> {
    Sample {
        parent,
        bytes,
        executable: Some(Path::new("/node")),
    }
}

#[test]
fn resident_sum_includes_node_children_and_excludes_helpers_and_other_sidecars() {
    let processes = BTreeMap::from([
        (1, node(None, 20)),
        (10, node(Some(1), 30)),
        (11, node(Some(10), 40)),
        (12, node(Some(10), 50)),
        (13, node(Some(11), 60)),
        (
            14,
            Sample {
                executable: Some(Path::new("/esbuild")),
                ..node(Some(10), u64::MAX)
            },
        ),
        (20, node(Some(1), 70)),
        (21, node(Some(20), 80)),
    ]);
    assert_eq!(tree_bytes(10, &processes), 180);
    assert_eq!(tree_bytes(20, &processes), 150);
    assert_eq!(tree_bytes(99, &processes), 0);
}

#[test]
fn transient_process_cycles_and_overflow_do_not_repeat_or_wrap_memory() {
    let processes = BTreeMap::from([(1, node(Some(2), u64::MAX)), (2, node(Some(1), 1))]);
    assert_eq!(tree_bytes(1, &processes), u64::MAX);
}

#[test]
fn unavailable_executable_metadata_keeps_descendants_in_the_bound() {
    let processes = BTreeMap::from([
        (
            1,
            Sample {
                executable: None,
                ..node(None, 10)
            },
        ),
        (2, node(Some(1), 20)),
    ]);
    assert_eq!(tree_bytes(1, &processes), 30);
}
