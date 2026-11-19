//! Portable path diagnostics escape control characters for the static boundary.

use crate::error::Error;

#[test]
fn portable_error_quotes_category_cc_characters_as_lowercase_json_escapes() {
    let error = Error::Portable {
        path: "a\u{85}\u{7f}\n\"b".into(),
    };
    assert_eq!(
        error.to_string(),
        "[mokly-static] The output path \"a\\u0085\\u007f\\n\\\"b\" is not portable. Rename that file or folder, then build again."
    );
}
