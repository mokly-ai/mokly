//! Resolved source identities participate in configuration keys without absolute paths.

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use serde_json::json;

use crate::error::{InternalError, Result};
use crate::key::{NodeKey, NodeKind, data_key};

pub(crate) fn resolved(config: &ResolvedConfig, version: &str) -> Result<NodeKey> {
    let mut input = config.input.clone();
    input.repo_root = Some(".".into());
    let settings = match serde_json::to_value(&input) {
        Ok(value) => value,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    let roots: Vec<_> = config.roots.iter().map(|root| json!({"directory":relative(&root.directory,&config.repo_root),"identity":relative(&root.identity,&config.repo_root)})).collect();
    let inputs: Vec<_> = config
        .authored_inputs
        .iter()
        .map(|path| relative(path, &config.repo_root))
        .collect();
    data_key(
        NodeKind::Config,
        json!({"config":settings,"file":relative(&config.file,&config.repo_root),"roots":roots,"inputs":inputs,"version":version}),
    )
}
