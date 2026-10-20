//! Case aliases of private directories must not become public resources.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::policy::{FilePolicy, PublicPolicy};
use crate::public_denial::PublicDenial;

#[test]
fn a_case_alias_of_the_output_directory_stays_private() {
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let directory = path.extension().is_none();
                Ok(Some(Node {
                    identity: if directory {
                        "/repo/site".into()
                    } else {
                        "/repo/site/logo.svg".into()
                    },
                    lexical_kind: if directory {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    },
                    kind: if directory {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    },
                }))
            }),
    ));
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let policy = FilePolicy::new(
        tree,
        &config,
        &[],
        BTreeMap::new(),
        Some(Path::new("/repo/site")),
    )
    .unwrap();
    assert_eq!(
        policy.check("SITE/logo.svg").unwrap_err(),
        PublicDenial::Private
    );
    assert_eq!(
        policy.recheck("SITE/logo.svg").unwrap_err(),
        PublicDenial::Private
    );
}

#[test]
fn case_aliases_of_private_source_files_keep_their_classification() {
    for (path, sources, expected) in [
        (
            "PRIVATE.TXT",
            vec!["private.txt".into()],
            PublicDenial::Listed,
        ),
        ("PRIVATE.SOURCE.TS", vec![], PublicDenial::Reserved),
        ("SPECS/HOME.SCREEN.HTML", vec![], PublicDenial::RootMatch),
    ] {
        let tree = Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, path| {
                    let kind = if path.extension().is_none() {
                        FileKind::Directory
                    } else {
                        FileKind::File
                    };
                    Ok(Some(Node {
                        identity: path.to_string_lossy().to_ascii_lowercase().into(),
                        lexical_kind: kind,
                        kind,
                    }))
                }),
        ));
        let config = ResolvedConfig {
            input: Config::default(),
            file: "/repo/mokly.config.json".into(),
            repo_root: "/repo".into(),
            authored_inputs: Vec::new(),
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
        let policy = FilePolicy::new(tree, &config, &sources, BTreeMap::new(), None).unwrap();
        assert_eq!(policy.check(path).unwrap_err(), expected);
        assert_eq!(policy.recheck(path).unwrap_err(), expected);
    }
}
