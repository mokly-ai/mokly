//! Integration tests read the same npm version that the CLI embeds at build time.

use std::fs;
use std::path::Path;

pub fn read() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly/package.json");
    let value: serde_json::Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
    value["version"].as_str().unwrap().to_owned()
}
