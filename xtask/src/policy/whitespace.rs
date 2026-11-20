//! Whitespace rules for Git-visible text, with the repository's Git attributes.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::str;

use crate::command::CommandSpec;
use crate::error::{Error, Result, reject};
use crate::policy::diagnostic::Violation;

use super::environment::Environment;

#[derive(Default)]
struct Attributes {
    binary: bool,
    allow_trailing: bool,
    allow_final_blank: bool,
}

pub(super) fn check(environment: &dyn Environment) -> Result<()> {
    let files = environment.files()?;
    let input = files
        .iter()
        .map(|path| format!("{}\0", path.display()))
        .collect();
    let output = environment.output(
        &CommandSpec::new("git")
            .args(["check-attr", "-z", "--stdin", "text", "whitespace"])
            .with_input(input),
    )?;
    let attributes = attributes(&output)?;
    let mut violations = Vec::new();
    for path in files {
        let default = Attributes::default();
        let attributes = attributes.get(&path).unwrap_or(&default);
        let bytes = environment.read(&path)?;
        if !attributes.binary {
            violations.extend(validate(&path, &bytes, attributes));
        }
    }
    reject(violations)
}

fn attributes(output: &str) -> Result<BTreeMap<PathBuf, Attributes>> {
    let fields: Vec<_> = output.split_terminator('\0').collect();
    let (records, remainder) = fields.as_chunks::<3>();
    if !remainder.is_empty() {
        return Err(Error::InvalidGitAttributes);
    }
    let mut attributes = BTreeMap::<PathBuf, Attributes>::new();
    for [path, attribute, value] in records {
        let rules = attributes.entry(PathBuf::from(path)).or_default();
        match *attribute {
            "text" => rules.binary = *value == "unset",
            "whitespace" => {
                rules.allow_trailing = value.split(',').any(|flag| flag == "-blank-at-eol");
                rules.allow_final_blank = value.split(',').any(|flag| flag == "-blank-at-eof");
            }
            _ => (),
        }
    }
    Ok(attributes)
}

fn validate(path: &Path, bytes: &[u8], attributes: &Attributes) -> Vec<Violation> {
    let Ok(text) = str::from_utf8(bytes) else {
        return Vec::new();
    };
    if text.contains('\0') {
        return Vec::new();
    }
    let mut violations = Vec::new();
    for (line, text) in text.lines().enumerate() {
        if !attributes.allow_trailing && text.ends_with([' ', '\t']) {
            violations.push(Violation::TrailingWhitespace {
                path: path.to_owned(),
                line: line + 1,
            });
        }
    }
    if !text.is_empty() && !text.ends_with('\n') {
        violations.push(Violation::FinalNewline(path.to_owned()));
    }
    if !attributes.allow_final_blank
        && text
            .lines()
            .next_back()
            .is_some_and(|line| line.trim().is_empty())
    {
        violations.push(Violation::FinalBlankLine(path.to_owned()));
    }
    violations
}

#[cfg(test)]
#[path = "_tests_/whitespace_tests.rs"]
mod whitespace_tests;
