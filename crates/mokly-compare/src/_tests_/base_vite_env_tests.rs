//! Freshness of the bytes selected by a working dotenv path.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_git::repository::RepositoryMock;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::ViteEnvInputs;

#[test]
fn linked_working_dotenv_stays_current_until_target_bytes_change() {
    let repository = Unimock::new(
        RepositoryMock::indexed_paths
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
    );
    let node = Node {
        identity: "/shared/working.env".into(),
        lexical_kind: FileKind::Symlink,
        kind: FileKind::File,
    };
    let inputs = ViteEnvInputs {
        indexed: Vec::new(),
        index_patterns: Vec::new(),
        files: BTreeMap::from([("/repo/env/.env.local".into(), Some("original".into()))]),
        consistent: true,
    };
    for (digest, expected) in [("original", true), ("edited", false)] {
        let tree = Unimock::new((
            SourceTreeMock::project
                .some_call(matching!((path) if *path == Path::new("/repo/env/.env.local")))
                .returns(Ok(Some(node.clone()))),
            SourceTreeMock::digest_unretained
                .some_call(matching!((path) if *path == Path::new("/shared/working.env")))
                .returns(Ok(digest.into())),
        ));
        assert_eq!(
            inputs.current(&repository, &tree).unwrap(),
            expected,
            "{digest}"
        );
    }
}
