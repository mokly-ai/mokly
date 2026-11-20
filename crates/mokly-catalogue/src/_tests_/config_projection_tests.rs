//! Root projection failures retain repository-relative diagnostics.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config::{ConfigLoader, Loader};
use crate::error::CatalogueError;

#[test]
fn root_projection_errors_name_the_repository_relative_path_and_code() {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .next_call(matching!((path) if *path==Path::new("/repo/mokly.config.json")))
            .returns(Ok(Some(Node {
                identity: "/repo/mokly.config.json".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::File,
            }))),
        SourceTreeMock::read
            .next_call(matching!((path) if *path == Path::new("/repo/mokly.config.json")))
            .returns(Ok(b"{}".to_vec())),
        SourceTreeMock::project
            .next_call(matching!((path) if *path==Path::new("/repo")))
            .returns(Ok(Some(Node {
                identity: "/repo".into(),
                kind: FileKind::Directory,
                lexical_kind: FileKind::Directory,
            }))),
        SourceTreeMock::project
            .next_call(matching!((path) if *path==Path::new("/repo/specs")))
            .returns(Err(SourceError::Io {
                operation: "project",
                path: "/repo/specs".into(),
                source: io::Error::from(io::ErrorKind::PermissionDenied),
            })),
    )));
    let loader: &dyn ConfigLoader = &Loader { tree };
    let CatalogueError::Config(issue) = loader
        .load(Path::new("/repo"), Some("mokly.config.json"))
        .unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issue.message, "specs: EACCES");
}

#[test]
fn a_linked_root_names_the_link() {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let node = if path == Path::new("/repo/mokly.config.json") {
                    Some(Node {
                        identity: path.into(),
                        kind: FileKind::File,
                        lexical_kind: FileKind::File,
                    })
                } else if path == Path::new("/repo") {
                    Some(Node {
                        identity: path.into(),
                        kind: FileKind::Directory,
                        lexical_kind: FileKind::Directory,
                    })
                } else if path == Path::new("/repo/specs") {
                    Some(Node {
                        identity: path.into(),
                        kind: FileKind::Symlink,
                        lexical_kind: FileKind::Symlink,
                    })
                } else {
                    None
                };
                Ok(node)
            }),
        SourceTreeMock::read
            .next_call(matching!((path) if *path == Path::new("/repo/mokly.config.json")))
            .returns(Ok(b"{}".to_vec())),
    )));
    let CatalogueError::Config(issue) = Loader { tree }
        .load(Path::new("/repo"), Some("mokly.config.json"))
        .unwrap_err()
    else {
        panic!()
    };
    assert_eq!(
        issue.message,
        "roots[0].dir: specs uses the symbolic link specs; name the target path instead"
    );
}

fn linked_repository_tree(config: &str) -> Arc<dyn SourceTree> {
    Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let (identity, kind, lexical_kind) =
                    if path == Path::new("/settings/mokly.config.json") {
                        (path.into(), FileKind::File, FileKind::File)
                    } else if path == Path::new("/settings/repository") {
                        ("/repo".into(), FileKind::Directory, FileKind::Symlink)
                    } else if path == Path::new("/repo/specs")
                        || path == Path::new("/settings/repository/specs")
                    {
                        (
                            "/repo/specs".into(),
                            FileKind::Directory,
                            FileKind::Directory,
                        )
                    } else if path == Path::new("/repo/renderer.tsx") {
                        (
                            "/repo/source/renderer.tsx".into(),
                            FileKind::File,
                            FileKind::Symlink,
                        )
                    } else {
                        return Ok(None);
                    };
                Ok(Some(Node {
                    identity,
                    kind,
                    lexical_kind,
                }))
            }),
        SourceTreeMock::read
            .some_call(matching!((path) if *path == Path::new("/settings/mokly.config.json")))
            .returns(Ok(config.as_bytes().to_vec())),
    )))
}

#[test]
fn a_linked_repository_accepts_roots_inside_its_resolved_target() {
    let tree = linked_repository_tree(
        r#"{"repoRoot":"repository","roots":[{"dir":"../repo/specs"}],"renderer":"../repo/renderer.tsx"}"#,
    );
    let loader: &dyn ConfigLoader = &Loader { tree };
    let resolved = loader.load(Path::new("/settings"), Some("mokly.config.json"));
    assert_eq!(
        resolved
            .as_ref()
            .ok()
            .map(|config| config.roots[0].directory.as_path()),
        Some(Path::new("/repo/specs")),
        "{resolved:?}"
    );
    let config = resolved.unwrap();
    assert_eq!(config.repo_root, Path::new("/repo"));
    assert_eq!(config.roots[0].identity, Path::new("/repo/specs"));
    assert_eq!(config.renderer().as_deref(), Some("source/renderer.tsx"));
}

#[test]
fn a_linked_repository_rejects_roots_outside_its_resolved_target() {
    let tree =
        linked_repository_tree(r#"{"repoRoot":"repository","roots":[{"dir":"repository/specs"}]}"#);
    let loader: &dyn ConfigLoader = &Loader { tree };
    let resolved = loader.load(Path::new("/settings"), Some("mokly.config.json"));
    assert!(
        matches!(resolved, Err(CatalogueError::Config(_))),
        "{resolved:?}"
    );
    let CatalogueError::Config(issue) = resolved.unwrap_err() else {
        panic!()
    };
    assert_eq!(
        issue.message,
        "roots[0].dir: repository/specs is outside repoRoot"
    );
}
