//! Runtime inventory serialization shared with the JavaScript package builds.

use serde::Serialize;

use crate::error::{ErrorResultExt, Result};

/// Generated record inside each package's output directory.
pub(crate) const FILE_NAME: &str = ".runtime-inventory.json";

/// Record the native executable with the same schema as the package scripts.
pub(crate) fn native_inventory(executable: &str, sha256: String) -> Result<String> {
    let inventory = RuntimeInventory {
        schema_version: 1,
        files: vec![RuntimeFile {
            path: executable,
            sha256,
        }],
    };
    let text = serde_json::to_string_pretty(&inventory).context("serialize runtime inventory")?;
    Ok(format!("{text}\n"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInventory<'a> {
    schema_version: u8,
    files: Vec<RuntimeFile<'a>>,
}

#[derive(Serialize)]
struct RuntimeFile<'a> {
    path: &'a str,
    sha256: String,
}
