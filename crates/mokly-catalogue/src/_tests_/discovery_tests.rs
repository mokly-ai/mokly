//! Discovery races and physical ownership use the object-safe source boundary.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use crate::discovery::{Discoverer, Discovery};
use crate::error::CatalogueError;

fn config() -> ResolvedConfig {
    ResolvedConfig {
        authored_inputs: Vec::new(),
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: "/repo/specs".into(),
            identity: "/repo/specs".into(),
        }],
    }
}

fn error(message: &str, result: crate::error::Result<crate::discovery::Inventory>) {
    let CatalogueError::Config(issue) = result.unwrap_err() else {
        panic!()
    };
    assert_eq!(issue.message, message);
}

#[test]
fn vanished_or_replaced_only_candidates_are_listed_under_not_searched() {
    for node in [
        None,
        Some(Node {
            identity: "/repo/specs/home.screen.html".into(),
            kind: FileKind::Directory,
            lexical_kind: FileKind::Directory,
        }),
    ] {
        let mock = Arc::new(Unimock::new((
            SourceTreeMock::children
                .next_call(matching!((path) if *path==Path::new("/repo/specs")))
                .returns(Ok(vec![Child {
                    name: "home.screen.html".into(),
                    kind: FileKind::File,
                }])),
            SourceTreeMock::project
                .next_call(matching!((path) if *path==Path::new("/repo/specs/home.screen.html")))
                .returns(Ok(node)),
        )));
        let discovery: &dyn Discovery = &Discoverer { tree: mock };
        error(
            "root matches no file: specs; not searched: specs/home.screen.html",
            discovery.discover(&config(), None),
        );
    }
}

#[test]
fn non_benign_candidate_projection_reports_the_relative_path_and_code() {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(vec![Child {
                name: "home.md".into(),
                kind: FileKind::File,
            }])),
        SourceTreeMock::project
            .next_call(matching!(_))
            .returns(Err(SourceError::Io {
                operation: "project",
                path: "/repo/specs/home.md".into(),
                source: io::Error::from(io::ErrorKind::PermissionDenied),
            })),
    )));
    let discovery: &dyn Discovery = &Discoverer { tree: mock };
    error("specs/home.md: EACCES", discovery.discover(&config(), None));
}

#[test]
fn vanished_directories_are_benign_and_denied_directory_names_are_not_opened() {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::children
            .next_call(matching!((path) if *path==Path::new("/repo/specs")))
            .returns(Ok(vec![
                Child {
                    name: "target".into(),
                    kind: FileKind::Directory,
                },
                Child {
                    name: "gone".into(),
                    kind: FileKind::Directory,
                },
            ])),
        SourceTreeMock::children
            .next_call(matching!((path) if *path==Path::new("/repo/specs/gone")))
            .returns(Err(SourceError::Io {
                operation: "list",
                path: "/repo/specs/gone".into(),
                source: io::Error::from(io::ErrorKind::NotADirectory),
            })),
    )));
    let discovery: &dyn Discovery = &Discoverer { tree: mock };
    error(
        "root matches no file: specs; not searched: specs/gone, specs/target",
        discovery.discover(&config(), None),
    );
}

#[test]
fn physical_aliases_cannot_escape_the_repository() {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(vec![Child {
                name: "home.md".into(),
                kind: FileKind::File,
            }])),
        SourceTreeMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(Node {
                identity: "/outside/home.md".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::File,
            }))),
    )));
    let discovery: &dyn Discovery = &Discoverer { tree: mock };
    error(
        "file specs/home.md resolves outside repoRoot; matched roots[0].files",
        discovery.discover(&config(), None),
    );
}

#[test]
fn overlapping_roots_validate_accepted_and_vanished_candidates_once_per_pass() {
    let children = || {
        vec![
            Child {
                name: "a-gone.md".into(),
                kind: FileKind::File,
            },
            Child {
                name: "home.md".into(),
                kind: FileKind::File,
            },
        ]
    };
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(children())),
        SourceTreeMock::project
            .next_call(matching!((path) if path.ends_with("a-gone.md")))
            .returns(Ok(None)),
        SourceTreeMock::project
            .next_call(matching!((path) if path.ends_with("home.md")))
            .returns(Ok(Some(Node {
                identity: "/repo/specs/home.md".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::File,
            }))),
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(children())),
    )));
    let mut config = config();
    config.roots.push(config.roots[0].clone());
    let discovery: &dyn Discovery = &Discoverer { tree: mock };
    error(
        "file specs/home.md is matched by roots[0] and roots[1]",
        discovery.discover(&config, None),
    );
}
