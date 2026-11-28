//! Resolved source identities participate in configuration keys without absolute paths.

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use serde_json::json;

use crate::key::{NodeKey, NodeKind, data_key};

pub(crate) fn resolved(config: &ResolvedConfig, version: &str) -> NodeKey {
    let mut input = config.input.clone();
    input.repo_root = Some(".".into());
    input.renderer = config.renderer();
    input.postcss = config.postcss();
    let settings = serde_json::to_value(&input)
        .expect("configuration fields contain only JSON values and string keys");
    let roots: Vec<_> = config
        .roots
        .iter()
        .map(|root| {
            let mut identity = json!({
                "directory":relative(&root.directory,&config.repo_root),
                "identity":relative(&root.identity,&config.repo_root),
            });
            if root.from_storybook_main() {
                identity["files"] = json!(root.input.files);
            }
            identity
        })
        .collect();
    let inputs: Vec<_> = config
        .authored_inputs
        .iter()
        .map(|path| relative(path, &config.repo_root))
        .collect();
    let mut data = json!({"config":settings,"file":relative(&config.file,&config.repo_root),"roots":roots,"inputs":inputs,"version":version});
    let storybook = config.storybook_inputs();
    if !storybook.is_empty() {
        data["storybookInputs"] = json!(storybook);
    }
    data_key(NodeKind::Config, data)
}
