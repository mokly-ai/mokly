//! Embed the public npm package version into the native CLI.

use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum Error {
    #[error("[mokly-cli/build] could not read package metadata: {source}")]
    Read { source: std::io::Error },
    #[error("[mokly-cli/build] invalid package metadata: {source}")]
    Json { source: serde_json::Error },
    #[error("[mokly-cli/build] package metadata requires a non-empty version")]
    Version,
    #[error("[mokly-cli/build] could not emit build options: {source}")]
    Write { source: std::io::Error },
    #[error("[mokly-cli/build] could not create native build identity: {source}")]
    Clock { source: std::time::SystemTimeError },
}

#[cfg(not(test))]
fn main() -> Result<(), Error> {
    emit(
        &env::var("CARGO_CFG_TARGET_OS").unwrap_or_default(),
        &env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default(),
        &mut std::io::stdout(),
    )
}

/// Emit target-specific linker settings and the public package version.
/// A Windows MSVC binary reserves an 8 MiB main-thread stack to match the usual Linux
/// and macOS main-thread stack, because the MSVC default is 1 MiB.
/// Other targets leave the invocation marker absent to cover dependency-feature rebuilds.
/// Each such build embeds a new nonce, including a build with unchanged source files.
pub(crate) fn emit(target_os: &str, target_env: &str, output: &mut dyn Write) -> Result<(), Error> {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly/package.json");
    let mut options = format!("cargo:rerun-if-changed={}\n", manifest.display());
    if target_os == "windows" && target_env == "msvc" {
        options.push_str("cargo:rustc-link-arg-bins=/STACK:8388608\n");
    }
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
    options.push_str(&format!("cargo:rustc-env=MOKLY_VERSION={version}\n"));
    if target_os != "linux"
        && let Some(output) = env::var_os("OUT_DIR")
    {
        let marker = Path::new(&output).join("native-build-invocation");
        options.push_str(&format!("cargo:rerun-if-changed={}\n", marker.display()));
    }
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    for input in [
        "crates",
        ".cargo",
        "Cargo.toml",
        "Cargo.lock",
        "rust-toolchain.toml",
        "packages/mokly/package.json",
        "packages/mokly/config.schema.json",
    ] {
        options.push_str(&format!(
            "cargo:rerun-if-changed={}\n",
            root.join(input).display()
        ));
    }
    for name in [
        "RUSTC",
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "RUSTC_WRAPPER",
        "RUSTC_WORKSPACE_WRAPPER",
        "PROFILE",
        "OPT_LEVEL",
        "DEBUG",
        "TARGET",
        "HOST",
    ]
    .into_iter()
    .map(String::from)
    .chain(
        env::vars()
            .map(|(name, _)| name)
            .filter(|name| name.starts_with("CARGO_FEATURE_")),
    ) {
        options.push_str(&format!("cargo:rerun-if-env-changed={name}\n"));
    }
    let time = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(time) => time.as_nanos(),
        Err(source) => return Err(Error::Clock { source }),
    };
    options.push_str(&format!(
        "cargo:rustc-env=MOKLY_NATIVE_BUILD={time}-{}\n",
        std::process::id()
    ));
    if let Err(source) = output.write_all(options.as_bytes()) {
        return Err(Error::Write { source });
    }
    Ok(())
}
