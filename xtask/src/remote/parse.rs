//! Pure parsing of remote identities and cleanup references.

use crate::remote::contracts::GithubRunState;
use crate::remote::error::{Error, Result};

/// Interpret the CLI's selected status without a JSON dependency.
pub(super) fn github_run_state(output: &str) -> Result<GithubRunState> {
    match output.trim() {
        "" => Err(Error::EmptyGithubState),
        "completed" => Ok(GithubRunState::Completed),
        _ => Ok(GithubRunState::Other),
    }
}

/// Extract canonical whole-line box identifiers, including recoverable extras.
pub(super) fn warmup_ids(output: &str) -> Vec<String> {
    output
        .lines()
        .filter(|line| {
            line.strip_prefix("tbx_").is_some_and(|suffix| {
                !suffix.is_empty()
                    && suffix
                        .bytes()
                        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
            })
        })
        .map(str::to_owned)
        .collect()
}

/// Require exactly one warmup identifier line.
pub(super) fn require_warmup_id(output: &str) -> Result<String> {
    let ids = warmup_ids(output);
    if ids.len() != 1 {
        return Err(Error::WarmupIds { count: ids.len() });
    }
    match ids.into_iter().next() {
        Some(id) => Ok(id),
        None => Err(Error::WarmupIds { count: 0 }),
    }
}

/// Recognize a complete lowercase hexadecimal field.
fn hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// Validate the one fingerprint and one HEAD line despite CLI status noise.
pub(super) fn probe_identity(output: &str, fingerprint: &str, head: &str) -> Result<()> {
    let fingerprints: Vec<_> = output
        .lines()
        .filter(|line| {
            line.strip_prefix("sha256:")
                .is_some_and(|value| hex(value, 64))
        })
        .collect();
    let heads: Vec<_> = output.lines().filter(|line| hex(line, 40)).collect();
    if fingerprints != [fingerprint] {
        return Err(Error::Identity {
            field: "fingerprint",
            expected: fingerprint.to_owned(),
        });
    }
    if heads != [head] {
        return Err(Error::Identity {
            field: "HEAD",
            expected: head.to_owned(),
        });
    }
    Ok(())
}

/// Validate local fingerprint output before inserting it into remote shell text.
pub(super) fn fingerprint_value(output: &str) -> Result<String> {
    let lines: Vec<_> = output.lines().collect();
    if lines.len() == 1
        && lines[0]
            .strip_prefix("sha256:")
            .is_some_and(|value| hex(value, 64))
    {
        return Ok(lines[0].to_owned());
    }
    Err(Error::Identity {
        field: "fingerprint",
        expected: "one sha256:<64 lowercase hex digits> line".to_owned(),
    })
}

/// Find the first numeric GitHub Actions run URL in status output.
pub(super) fn run_id_from_status(output: &str) -> Option<u64> {
    output.split("/actions/runs/").skip(1).find_map(|tail| {
        let digits: String = tail.chars().take_while(char::is_ascii_digit).collect();
        digits.parse().ok()
    })
}

/// Prove completion only from one box row and the named table status column.
pub(super) fn box_is_completed(output: &str, id: &str) -> bool {
    let status_column = output.lines().find_map(|line| {
        let columns: Vec<_> = line.split_ascii_whitespace().collect();
        if columns.first() != Some(&"ID") {
            return None;
        }
        columns.iter().position(|column| *column == "STATUS")
    });
    let Some(column) = status_column else {
        return false;
    };
    let rows: Vec<Vec<_>> = output
        .lines()
        .map(|line| line.split_ascii_whitespace().collect())
        .filter(|row: &Vec<&str>| row.first() == Some(&id))
        .collect();
    rows.len() == 1 && rows[0].get(column) == Some(&"completed")
}

#[cfg(test)]
#[path = "_tests_/parsing_tests.rs"]
mod parsing_tests;
