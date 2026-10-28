//! Package roots keep one normalized meaning in every source tree.

use std::io;
use std::path::{Component, Path};
use std::sync::Arc;

use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config_paths::validate_inputs;
use crate::config_types::{Config, ModuleResolution, ResolvedConfig};
use crate::error::CatalogueError;

fn config(roots: &[&str]) -> ResolvedConfig {
    ResolvedConfig {
        input: Config {
            module_resolution: Some(ModuleResolution {
                package_roots: Some(roots.iter().map(|root| (*root).into()).collect()),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/tools/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

/// Listed spellings exist exactly; any other `..` spelling fails like a Git tree.
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
                if path.components().any(|part| part == Component::ParentDir) {
                    return Err(SourceError::Io {
                        operation: "project",
                        path: path.into(),
                        source: io::Error::from(io::ErrorKind::InvalidInput),
                    });
                }
                Ok(None)
            })),
    )
}

fn message(tree: &Unimock, roots: &[&str]) -> String {
    let CatalogueError::Config(issue) = validate_inputs(tree, &config(roots)).unwrap_err() else {
        panic!()
    };
    issue.message
}

#[test]
fn package_roots_are_repository_relative_without_dot_segments() {
    let config = config(&["../packages/ui", "./ui", "ui/", ".", "..", "a/./b/../c"]);
    assert_eq!(
        config.package_roots(),
        [
            "packages/ui",
            "tools/ui",
            "tools/ui",
            "tools",
            "",
            "tools/a/c"
        ]
    );
}

#[test]
fn a_tree_that_rejects_parent_segments_accepts_the_normalized_root() {
    let tree = tree(&[
        ("/repo/packages/ui", FileKind::Directory),
        ("/repo/packages/ui/package.json", FileKind::File),
    ]);
    validate_inputs(&tree, &config(&["../packages/ui"])).unwrap();
}

#[test]
fn rejected_roots_keep_their_authored_spelling_and_message() {
    let tree = tree(&[
        ("/repo/packages/ui", FileKind::Directory),
        ("/outside", FileKind::Directory),
    ]);
    assert_eq!(
        message(&tree, &["../packages/ui"]),
        "moduleResolution.packageRoots[0]: ../packages/ui must contain package.json"
    );
    assert_eq!(
        message(&tree, &["../../outside"]),
        "moduleResolution.packageRoots[0]: ../../outside is outside repoRoot"
    );
    assert_eq!(
        message(&tree, &["../missing"]),
        "moduleResolution.packageRoots[0]: ../missing does not exist"
    );
}

#[test]
fn only_the_normalized_root_satisfies_the_manifest_rule() {
    let link_target_only = tree(&[
        ("/repo/tools/ui", FileKind::Directory),
        ("/repo/tools/link/../ui/package.json", FileKind::File),
    ]);
    assert_eq!(
        message(&link_target_only, &["link/../ui"]),
        "moduleResolution.packageRoots[0]: link/../ui must contain package.json"
    );
    let normalized_root = tree(&[
        ("/repo/tools/ui", FileKind::Directory),
        ("/repo/tools/ui/package.json", FileKind::File),
    ]);
    validate_inputs(&normalized_root, &config(&["link/../ui"])).unwrap();
}
