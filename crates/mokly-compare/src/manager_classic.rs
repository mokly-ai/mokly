//! Scalar tokens from Yarn Classic lockfiles and configuration without execution.

use std::path::Path;

use crate::ancestor_roots;
use crate::error::{Error, InternalError, Result};
use crate::inputs::Inputs;
use crate::manager_yaml;
use crate::manifest;

#[derive(Clone, Debug)]
pub(crate) struct Configuration {
    mirror: Option<String>,
}

impl Configuration {
    pub(crate) fn read(inputs: &Inputs, root: &str) -> Result<Self> {
        for directory in ancestor_roots::directories(root) {
            let path = if directory.is_empty() {
                ".yarnrc".to_owned()
            } else {
                format!("{directory}/.yarnrc")
            };
            let Some((_, bytes)) = inputs.files.iter().find(|(key, _)| key.as_str() == path) else {
                continue;
            };
            let text = match str::from_utf8(bytes) {
                Ok(text) => text,
                Err(_) => return Err(Error::InvalidInput { path }),
            };
            let fields = manager_yaml::fields(bytes, &path).unwrap_or_default();
            let tokens = strings(text, &path)?;
            let mirror = fields
                .get("yarn-offline-mirror")
                .and_then(Option::as_deref)
                .or_else(|| {
                    tokens
                        .chunks_exact(2)
                        .rev()
                        .find(|pair| pair[0] == "yarn-offline-mirror")
                        .map(|pair| pair[1].as_str())
                });
            if let Some(mirror) = mirror {
                return Ok(Self {
                    mirror: if mirror == "false" {
                        None
                    } else {
                        Some(manifest::target(&directory, mirror)?)
                    },
                });
            }
        }
        Ok(Self { mirror: None })
    }

    pub(crate) fn contents(&self, destination: &Path) -> Result<Vec<u8>> {
        let value = match &self.mirror {
            Some(relative) => {
                match serde_json::to_string(&destination.join(relative).to_string_lossy()) {
                    Ok(value) => value,
                    Err(source) => return Err(InternalError::Json { source }.into()),
                }
            }
            None => "false".into(),
        };
        Ok(
            format!("yarn-offline-mirror {value}\nyarn-offline-mirror-pruning false\n")
                .into_bytes(),
        )
    }
}

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
                .find(|character: char| character.is_whitespace() || matches!(character, ',' | ':'))
                .unwrap_or(remaining.len());
            values.push(remaining[..end].trim_end_matches(':').to_owned());
            remaining = &remaining[end..];
        }
    }
    Ok(values)
}
