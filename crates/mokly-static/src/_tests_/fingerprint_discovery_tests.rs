//! Discovery owns required-file diagnostics; unreadable exclusions remain fingerprinted.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_model::output::validation::digest;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::fingerprint::{CapturedTree, InputTree};

fn bytes(path: &Path, excluded: bool) -> Result<Arc<[u8]>> {
    match path.file_name().unwrap().to_str().unwrap() {
        "_folder.json" => Ok(Arc::from(if excluded {
            br#"{"exclude":["blocked.screen.html"]}"#.as_slice()
        } else {
            b"{}".as_slice()
        })),
        "home.screen.html" => Ok(Arc::from(
            b"---\ntitle: Home\n---\n<h1>Home</h1>".as_slice(),
        )),
        "mokly.config.json" => Ok(Arc::from(b"{}".as_slice())),
        "blocked.screen.html" => Err(SourceError::Io {
            operation: "read",
            path: path.into(),
            source: io::Error::from(io::ErrorKind::PermissionDenied),
        }),
        _ => panic!("unexpected read: {}", path.display()),
    }
}

#[test]
fn unreadable_excluded_files_pass_while_required_files_keep_catalogue_diagnostics() {
    for excluded in [false, true] {
        let source = Unimock::new((
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, path| {
                    let kind = if path.ends_with("specs") {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    };
                    Ok(Some(Node {
                        identity: path.into(),
                        kind,
                        lexical_kind: kind,
                    }))
                }),
            SourceTreeMock::children
                .each_call(matching!((path) if *path == Path::new("/repo/specs")))
                .answers(&|_, _| {
                    Ok(["_folder.json", "home.screen.html", "blocked.screen.html"]
                        .into_iter()
                        .map(|name| Child {
                            name: name.into(),
                            kind: FileKind::File,
                        })
                        .collect())
                }),
            SourceTreeMock::digest
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| Ok(digest(&bytes(path, excluded)?)))),
            SourceTreeMock::read_shared
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    assert!(!excluded || !path.ends_with("blocked.screen.html"));
                    bytes(path, excluded)
                })),
            SourceTreeMock::prefetch
                .each_call(matching!(_))
                .answers(&|_, _| Ok(())),
        ));
        let config = ResolvedConfig {
            input: Config::default(),
            repo_root: "/repo".into(),
            file: "/repo/mokly.config.json".into(),
            authored_inputs: vec![],
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
        };
        let tree = Arc::new(CapturedTree::new(Arc::new(source)));
        tree.begin(&config, &[]).unwrap();
        let builder = Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree: tree.clone() }),
            definitions: Arc::new(Unimock::new(())),
        };
        let prepared = builder.prepare(&config, None);
        if excluded {
            let prepared = prepared.unwrap();
            assert_eq!(prepared.model.entries.len(), 1);
            assert_eq!(prepared.model.entries[0].metadata.path, "home");
            tree.capture(
                &config.repo_root,
                &prepared.model.sources,
                &Default::default(),
            )
            .unwrap();
            tree.verify().unwrap();
        } else {
            let error = prepared.unwrap_err().to_string();
            assert!(
                error.contains("specs/blocked.screen.html: EACCES"),
                "{error}"
            );
        }
    }
}
