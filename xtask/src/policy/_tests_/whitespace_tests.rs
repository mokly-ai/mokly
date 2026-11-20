//! Text and binary whitespace fixtures.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandSpec;
use crate::error::Error;
use crate::policy::diagnostic::Violation;
use crate::policy::environment::{FilesMock, OutputMock, ReadMock};

use super::{Attributes, check, validate};

#[test]
fn rejects_trailing_spaces_tabs_and_missing_final_newline() {
    let path = Path::new("new.md");
    assert_eq!(
        validate(path, b"first \nsecond\t\nlast", &Attributes::default()),
        vec![
            Violation::TrailingWhitespace {
                path: path.into(),
                line: 1
            },
            Violation::TrailingWhitespace {
                path: path.into(),
                line: 2
            },
            Violation::FinalNewline(path.into()),
        ]
    );
}

#[test]
fn accepts_empty_clean_crlf_and_binary_files() {
    for bytes in [
        b"".as_slice(),
        b"one\ntwo\n",
        b"one\r\ntwo\r\n",
        b"\xff ",
        b"\0 ",
    ] {
        assert!(validate(Path::new("file"), bytes, &Attributes::default()).is_empty());
    }
}

fn with_attributes(attributes: &str, bytes: &[u8]) -> Vec<Violation> {
    let bytes = bytes.to_vec();
    let output = format!(
        "file\0text\0{}\0file\0whitespace\0{}\0",
        if attributes == "-text" {
            "unset"
        } else {
            "auto"
        },
        if attributes == "-text" {
            "unspecified"
        } else {
            attributes
        }
    );
    let environment = Arc::new(Unimock::new((
        FilesMock.some_call(matching!()).returns(Ok(vec!["file".into()])),
        OutputMock.some_call(matching!((command) if *command == &CommandSpec::new("git").args(["check-attr", "-z", "--stdin", "text", "whitespace"]).with_input("file\0".into()))).returns(Ok(output)),
        ReadMock.each_call(matching!(_)).answers_arc(Arc::new(move |_, _| Ok(bytes.clone()))),
    )));
    match check(environment.as_ref()) {
        Ok(()) => Vec::new(),
        Err(Error::Violations(violations)) => violations,
        Err(error) => panic!("unexpected whitespace error: {error}"),
    }
}

#[test]
fn unset_text_preserves_every_fixture_byte() {
    assert_eq!(with_attributes("-text", b"first \n\nlast "), []);
}

#[test]
fn disabled_blank_at_eol_keeps_final_newline_and_blank_checks() {
    assert_eq!(
        with_attributes("-blank-at-eol", b"first \n\n"),
        [Violation::FinalBlankLine("file".into())]
    );
    assert_eq!(
        with_attributes("-blank-at-eol", b"last "),
        [Violation::FinalNewline("file".into())]
    );
}

#[test]
fn disabled_blank_at_eof_keeps_trailing_and_final_newline_checks() {
    assert_eq!(
        with_attributes("-blank-at-eof", b"first \n\n"),
        [Violation::TrailingWhitespace {
            path: "file".into(),
            line: 1
        }]
    );
    assert_eq!(
        with_attributes("-blank-at-eof", b"last"),
        [Violation::FinalNewline("file".into())]
    );
}

#[test]
fn unspecified_attributes_keep_all_whitespace_checks() {
    assert_eq!(
        with_attributes("unspecified", b"first \n\n"),
        [
            Violation::TrailingWhitespace {
                path: "file".into(),
                line: 1
            },
            Violation::FinalBlankLine("file".into())
        ]
    );
    assert_eq!(
        with_attributes("unspecified", b"last"),
        [Violation::FinalNewline("file".into())]
    );
}
