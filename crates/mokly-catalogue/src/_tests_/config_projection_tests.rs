//! Root projection failures retain repository-relative diagnostics.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
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
