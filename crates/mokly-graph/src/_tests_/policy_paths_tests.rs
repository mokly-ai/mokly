//! Case aliases of private directories must not become public resources.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
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
