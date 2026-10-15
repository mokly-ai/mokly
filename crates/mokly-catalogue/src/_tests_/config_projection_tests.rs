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
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(b"{}".to_vec())),
        SourceTreeMock::project
            .next_call(matching!((path) if *path==Path::new("/repo/mokly.config.json")))
            .returns(Ok(Some(Node {
                identity: "/repo/mokly.config.json".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::File,
            }))),
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
