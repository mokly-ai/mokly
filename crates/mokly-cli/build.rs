//! Embed the public npm package version into the native CLI.

use std::fs;
use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
enum Error {
    #[error("[mokly-cli/build] could not read package metadata: {source}")]
    Read { source: std::io::Error },
    #[error("[mokly-cli/build] invalid package metadata: {source}")]
    Json { source: serde_json::Error },
    #[error("[mokly-cli/build] package metadata requires a non-empty version")]
    Version,
}

fn main() -> Result<(), Error> {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly/package.json");
    println!("cargo:rerun-if-changed={}", manifest.display());
    let text = match fs::read_to_string(manifest) {
        Ok(text) => text,
        Err(source) => return Err(Error::Read { source }),
    };
    let metadata: serde_json::Value = match serde_json::from_str(&text) {
        Ok(metadata) => metadata,
        Err(source) => return Err(Error::Json { source }),
    };
    let Some(version) = metadata
        .get("version")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
    else {
        return Err(Error::Version);
    };
    println!("cargo:rustc-env=MOKLY_VERSION={version}");
    Ok(())
}
