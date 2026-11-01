//! Pure tests for configuration path link detection.

use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config_links::unresolved_link;

fn tree(nodes: &[(&'static str, FileKind)]) -> Unimock {
    let nodes = nodes.to_vec();
    Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if let Some((_, kind)) = nodes.iter().find(|(node, _)| Path::new(node) == path) {
                    return Ok(Some(Node {
                        identity: path.into(),
                        lexical_kind: *kind,
                        kind: *kind,
                    }));
                }
                Ok(None)
            })),
    )
}

#[test]
fn a_final_link_is_named() {
    let tree = tree(&[("/repo/link", FileKind::Symlink)]);
    assert_eq!(
        unresolved_link(&tree, Path::new("/repo/link"), Path::new("/repo")),
        Some("link".into())
    );
}

#[test]
fn a_link_above_the_path_is_named() {
    let tree = tree(&[("/repo/link", FileKind::Symlink)]);
    assert_eq!(
        unresolved_link(&tree, Path::new("/repo/link/child"), Path::new("/repo")),
        Some("link".into())
    );
}

#[test]
fn a_missing_prefix_has_no_link() {
    let tree = tree(&[]);
    assert_eq!(
        unresolved_link(&tree, Path::new("/repo/missing/child"), Path::new("/repo")),
        None
    );
}

#[test]
fn a_file_prefix_has_no_link() {
    let tree = tree(&[("/repo/file", FileKind::File)]);
    assert_eq!(
        unresolved_link(&tree, Path::new("/repo/file/child"), Path::new("/repo")),
        None
    );
}

#[test]
fn a_resolved_directory_path_has_no_link() {
    let tree = tree(&[
        ("/repo/dir", FileKind::Directory),
        ("/repo/dir/child", FileKind::Directory),
    ]);
    assert_eq!(
        unresolved_link(&tree, Path::new("/repo/dir/child"), Path::new("/repo")),
        None
    );
}

#[test]
fn an_outside_path_makes_no_projection() {
    let tree = Unimock::new(());
    assert_eq!(
        unresolved_link(&tree, Path::new("/outside/path"), Path::new("/repo")),
        None
    );
}
