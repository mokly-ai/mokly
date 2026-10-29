//! Detect independent Cargo versions and implicit clap version defaults.
//!
//! Cargo's unpublished crate version does not follow an npm Release Please
//! bump, so every Rust package-version path must use the npm-derived shared
//! version.

use std::sync::LazyLock;

use regex::Regex;

static CARGO_VERSION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bCARGO_PKG_VERSION(?:_[A-Z0-9_]+)?\b").unwrap());
static ATTRIBUTE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"#\s*\[\s*(?:command|clap)\s*\(").unwrap());
static RAW_STRING: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"^(?:br|r)(#*)""#).unwrap());
static CHARACTER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:b)?'(?:\\(?:u\{[a-fA-F0-9_]+\}|x[a-fA-F0-9]{2}|.)|[^'\\])'").unwrap()
});

/// The version problems of one Rust source: a Cargo version token anywhere,
/// including comments and strings, and each valueless clap `version` flag.
pub(crate) fn rust_package_version_problems(source: &str) -> Vec<&'static str> {
    let mut problems = Vec::new();
    if CARGO_VERSION.is_match(source) {
        problems.push("Cargo version token");
    }
    let code = without_comments_and_literals(source);
    let bytes = code.as_bytes();
    for attribute in ATTRIBUTE.find_iter(&code) {
        let mut depth = 1;
        let mut start = attribute.end();
        for index in attribute.end()..bytes.len() {
            let byte = bytes[index];
            if depth == 1 && (byte == b',' || byte == b')') {
                let argument = code[start..index].trim();
                if argument.strip_prefix("r#").unwrap_or(argument) == "version" {
                    problems.push("implicit clap version");
                }
                start = index + 1;
                if byte == b')' {
                    break;
                }
            } else if b"([{".contains(&byte) {
                depth += 1;
            } else if b")]}".contains(&byte) {
                depth -= 1;
            }
        }
    }
    problems
}

/// The source with each comment and each string, raw string, and character
/// literal replaced by one space. The scan works on bytes and slices the
/// text only at ASCII bytes, which are always character boundaries.
fn without_comments_and_literals(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut code = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index..].starts_with(b"//") {
            index = bytes[index..]
                .iter()
                .position(|byte| *byte == b'\n')
                .map_or(bytes.len(), |end| index + end);
        } else if bytes[index..].starts_with(b"/*") {
            index = block_comment_end(bytes, index + 2);
            code.push(b' ');
        } else {
            let byte = bytes[index];
            let raw = (byte == b'r' || byte == b'b')
                .then(|| RAW_STRING.captures(&source[index..]))
                .flatten();
            let character = (byte == b'\'' || byte == b'b')
                .then(|| CHARACTER.find(&source[index..]))
                .flatten();
            if let Some(raw) = raw {
                let ending = format!("\"{}", &raw[1]);
                let after = index + raw[0].len();
                index = source[after..]
                    .find(&ending)
                    .map_or(bytes.len(), |end| after + end + ending.len());
                code.push(b' ');
            } else if let Some(character) = character {
                index += character.end();
                code.push(b' ');
            } else if byte == b'"' {
                index += 1;
                while index < bytes.len() && bytes[index] != b'"' {
                    index += if bytes[index] == b'\\' { 2 } else { 1 };
                }
                index += 1;
                code.push(b' ');
            } else {
                code.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&code).into_owned()
}

/// The index after a nested block comment that opened before `index`.
fn block_comment_end(bytes: &[u8], mut index: usize) -> usize {
    let mut depth = 1;
    while index < bytes.len() && depth > 0 {
        if bytes[index..].starts_with(b"/*") {
            depth += 1;
            index += 2;
        } else if bytes[index..].starts_with(b"*/") {
            depth -= 1;
            index += 2;
        } else {
            index += 1;
        }
    }
    index
}
