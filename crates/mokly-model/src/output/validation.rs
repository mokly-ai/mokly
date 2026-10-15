//! Pure primitives shared by upload metadata and the ownership inventory.

use chrono::{NaiveDateTime, TimeZone, Utc};
use sha2::{Digest, Sha256};

use crate::output::error::{FormatError, Result};

/// Maximum byte length of a regular output file.
pub const FILE_LIMIT: usize = 64 * 1024 * 1024;
/// Maximum byte length of an upload metadata document.
pub const MANIFEST_LIMIT: usize = 16 * 1024;
/// Maximum byte length of an exchange response.
pub const RESPONSE_LIMIT: usize = 16 * 1024 * 1024;
/// Maximum regular files, including the ownership marker.
pub const FILE_COUNT_LIMIT: usize = 20_000;
/// Root ownership marker path.
pub const MARKER: &str = ".mokly-export-artifact";
/// Root upload metadata path.
pub const MANIFEST: &str = "mokly-upload.json";

/// SHA-256 of the exact supplied bytes.
pub fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Lowercase full object or content digest, with an explicit accepted length.
pub fn hexadecimal(value: &str, lengths: &[usize]) -> bool {
    lengths.contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// One portable root-relative path. Limit classification precedes grammar.
pub fn portable_path(value: &str) -> Result<()> {
    if value.len() > 1024 {
        return Err(FormatError::TooLarge);
    }
    if value.is_empty()
        || value
            .chars()
            .any(|character| character.is_control() || "\\:".contains(character))
        || value.split('/').any(|part| matches!(part, "" | "." | ".."))
    {
        return Err(FormatError::InvalidBundle);
    }
    Ok(())
}

/// Nonempty bounded metadata text without category Cc characters.
pub fn text(value: &str, limit: usize) -> bool {
    !value.is_empty() && value.len() <= limit && !value.chars().any(char::is_control)
}

/// Parse only the exact UTC millisecond timestamp spelling in the protocol.
pub fn timestamp(value: &str) -> Result<i64> {
    let bytes = value.as_bytes();
    if bytes.len() != 24
        || bytes.iter().enumerate().any(|(index, byte)| match index {
            4 | 7 => *byte != b'-',
            10 => *byte != b'T',
            13 | 16 => *byte != b':',
            19 => *byte != b'.',
            23 => *byte != b'Z',
            _ => !byte.is_ascii_digit(),
        })
    {
        return Err(FormatError::InvalidBundle);
    }
    if &value[17..19] > "59" {
        return Err(FormatError::InvalidBundle);
    }
    let Ok(date) = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.3fZ") else {
        return Err(FormatError::InvalidBundle);
    };
    if date.and_utc().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string() != value {
        return Err(FormatError::InvalidBundle);
    }
    Ok(Utc.from_utc_datetime(&date).timestamp_millis())
}
