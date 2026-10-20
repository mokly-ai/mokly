//! Scalar tokens from Yarn Classic lockfiles and configuration without execution.

use crate::error::{Error, Result};

pub(crate) fn strings(text: &str, path: &str) -> Result<Vec<String>> {
    let mut remaining = text;
    let mut values = Vec::new();
    while !remaining.is_empty() {
        remaining = remaining.trim_start_matches(|character: char| {
            character.is_whitespace() || character == ',' || character == ':'
        });
        if remaining.is_empty() {
            break;
        }
        if remaining.starts_with('#') {
            remaining = remaining
                .split_once('\n')
                .map(|(_, rest)| rest)
                .unwrap_or("");
        } else if remaining.starts_with('"') {
            let mut reader = serde_json::Deserializer::from_str(remaining).into_iter::<String>();
            let Some(Ok(value)) = reader.next() else {
                return Err(Error::InvalidInput { path: path.into() });
            };
            remaining = &remaining[reader.byte_offset()..];
            values.push(value);
        } else {
            let end = remaining
                .find(|character: char| character.is_whitespace() || character == ',')
                .unwrap_or(remaining.len());
            values.push(remaining[..end].trim_end_matches(':').to_owned());
            remaining = &remaining[end..];
        }
    }
    Ok(values)
}
