//! Escaped aliases and non-regular targets never reach the reader.

use std::path::Path;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::confined;

#[test]
fn escaped_parent_alias_and_fifo_have_no_document_digest() {
    for (identity, kind) in [
        ("/outside/image.svg", FileKind::File),
        ("/repo/assets/fifo", FileKind::Other),
    ] {
        let tree = Unimock::new(
            SourceTreeMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(Node {
                    identity: identity.into(),
                    lexical_kind: kind,
                    kind,
                }))),
        );
        assert_eq!(
            confined(&tree, Path::new("/repo"), "assets/image.svg"),
            None
        );
    }
}
