//! The binary under test, builds of consumer projects, and wire prop numbers.

use std::fs;
use std::path::Path;

use mokly_test_support::process::{Finished, Mokly};
use mokly_test_support::readers;
use serde_json::Value;

/// The suffix of every unsafe-integer warning.
pub(super) const UNSAFE: &str =
    "is outside the JavaScript safe integer range and uses the nearest binary64 value";

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// Build `root` into `mokly-static`, with `--strict` when `strict`.
pub(super) fn build(root: &Path, strict: bool) -> Finished {
    let args: &[&str] = if strict {
        &["build", "--no-changes", "--strict"]
    } else {
        &["build", "--no-changes"]
    };
    mokly().command(root, args, "plain").run()
}

/// The index bytes of the default build output.
pub(super) fn index_bytes(root: &Path) -> Vec<u8> {
    fs::read(root.join("mokly-static/mokly-viewer/index.json")).unwrap()
}

/// The index of the default build output, checked by the model reader.
pub(super) fn index(root: &Path) -> Value {
    readers::index(&index_bytes(root))
}

/// The binary64 value of the wire prop `name` in an entry's saved `props`, as the
/// viewer decodes it: the wire carries a decimal string that rounds to the nearest double.
pub(super) fn wire_number(props: &Value, name: &str) -> f64 {
    let Value::Array(pair) = &props[name] else {
        panic!("{name} is not a wire value: {props}");
    };
    assert_eq!(pair.len(), 2, "{props}");
    assert_eq!(pair[0], "number", "{props}");
    match &pair[1] {
        Value::String(text) => text.parse().expect("a decimal number"),
        other => other.as_f64().expect("a JSON number"),
    }
}

/// How often `text` occurs in `haystack`.
pub(super) fn count(haystack: &str, text: &str) -> usize {
    haystack.matches(text).count()
}
