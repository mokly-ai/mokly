//! The runtime identity and executable used by a scripts-on installation.

use std::path::PathBuf;

use serde::Deserialize;

use crate::error::{Error, InternalError, Result};

pub(crate) const PROBE: &str = "JSON.stringify({version:process.version,platform:process.platform,architecture:process.arch,executable:process.execPath})";

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct InstallNode {
    pub(crate) version: String,
    pub(crate) platform: String,
    pub(crate) architecture: String,
    pub(crate) executable: PathBuf,
}

pub(crate) fn decode(bytes: &[u8]) -> Result<InstallNode> {
    let node: InstallNode = match serde_json::from_slice(bytes) {
        Ok(node) => node,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    if !node.executable.is_absolute()
        || node.version.is_empty()
        || node.platform.is_empty()
        || node.architecture.is_empty()
    {
        return Err(Error::CommandUnavailable);
    }
    Ok(node)
}
