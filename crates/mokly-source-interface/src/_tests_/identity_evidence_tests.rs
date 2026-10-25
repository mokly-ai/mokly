//! Windows path spellings must not create false identity mismatches.

use std::path::Path;

use unimock::{MockFn, Unimock, matching};

use crate::identity_evidence::matches;
use crate::read_evidence::FileIdentity;
use crate::tree::{FileKind, Node, SourceTreeMock};

fn tree(node: &'static str) -> Unimock {
    Unimock::new((
        SourceTreeMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(Node {
                identity: node.into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))),
        SourceTreeMock::file_object
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some("device:file".into()))),
    ))
}

#[test]
fn verbatim_drive_and_unc_spellings_match_child_identities() {
    let drive = Path::new(r"C:\deep\postcss\tokens.txt");
    let drive_identity = FileIdentity {
        object: "device:file".into(),
        canonical: Some(Path::new(r"\\?\C:\deep\postcss\tokens.txt").into()),
    };
    assert!(matches(
        &tree(r"C:\deep\postcss\tokens.txt"),
        drive,
        &drive_identity
    ));

    let unc = Path::new(r"\\server\share\postcss\tokens.txt");
    let unc_identity = FileIdentity {
        object: "device:file".into(),
        canonical: Some(Path::new(r"\\?\UNC\server\share\postcss\tokens.txt").into()),
    };
    assert!(matches(
        &tree(r"\\server\share\postcss\tokens.txt"),
        unc,
        &unc_identity
    ));
}
