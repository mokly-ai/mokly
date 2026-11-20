//! Protocol-table parsing and exact agreement of toolchain pin files.

use std::collections::BTreeMap;
use std::path::Path;
use std::result;

use serde::Deserialize;

use crate::error::{ErrorResultExt, Result};
use crate::policy::diagnostic::Violation;

/// Versions read from the protocol, which remains the single source of truth.
pub(super) struct Pins {
    pub(super) rust: String,
    pub(super) node: String,
    pub(super) npm: String,
    pub(super) tar: String,
    pub(super) terraform: String,
    pub(super) helm: String,
}

#[derive(Deserialize)]
struct RustPin {
    toolchain: Toolchain,
}

#[derive(Deserialize)]
struct Toolchain {
    channel: String,
    components: Vec<String>,
}

#[derive(Deserialize)]
struct PackagePin {
    #[serde(rename = "packageManager")]
    package_manager: String,
    #[serde(default, rename = "devDependencies")]
    dev_dependencies: BTreeMap<String, String>,
}

pub(super) fn protocol(text: &str) -> result::Result<Pins, Vec<Violation>> {
    let mut versions = Vec::new();
    let mut violations = Vec::new();
    for tool in ["Rust", "Node", "npm", "tar", "Terraform", "Helm"] {
        let rows: Vec<_> = text
            .lines()
            .filter_map(|line| {
                let columns: Vec<_> = line.split('|').map(str::trim).collect();
                if columns.get(1) == Some(&tool) {
                    columns.get(2).copied()
                } else {
                    None
                }
            })
            .collect();
        if rows.len() == 1 && !rows[0].is_empty() {
            versions.push(rows[0].to_owned());
        } else {
            violations.push(Violation::MissingPin(tool.to_owned()));
        }
    }
    if !violations.is_empty() {
        return Err(violations);
    }
    Ok(Pins {
        rust: versions[0].clone(),
        node: versions[1].clone(),
        npm: versions[2].clone(),
        tar: versions[3].clone(),
        terraform: versions[4].clone(),
        helm: versions[5].clone(),
    })
}

#[derive(Deserialize)]
struct InfrastructurePins {
    terraform: String,
    helm: String,
}

#[derive(Deserialize)]
struct TerraformVersion {
    terraform_version: String,
}

pub(super) fn infrastructure(text: &str, pins: &Pins) -> Result<Vec<Violation>> {
    let actual: InfrastructurePins =
        serde_json::from_str(text).context("parse infrastructure pins")?;
    let mut violations = compare(
        "infra/toolchains.json",
        "terraform",
        &pins.terraform,
        &actual.terraform,
    );
    violations.extend(compare(
        "infra/toolchains.json",
        "helm",
        &pins.helm,
        &actual.helm,
    ));
    Ok(violations)
}

pub(super) fn terraform_version(text: &str) -> Result<String> {
    let version: TerraformVersion =
        serde_json::from_str(text).context("parse installed Terraform version")?;
    Ok(version.terraform_version)
}

pub(super) fn compare(path: &str, field: &str, expected: &str, actual: &str) -> Vec<Violation> {
    if actual == expected {
        Vec::new()
    } else {
        vec![Violation::PinMismatch {
            path: path.into(),
            field: field.to_owned(),
            expected: expected.to_owned(),
            actual: actual.to_owned(),
        }]
    }
}

pub(super) fn rust(text: &str, pins: &Pins) -> Result<Vec<Violation>> {
    let pin: RustPin = toml::from_str(text).context("parse rust-toolchain.toml")?;
    let mut violations = compare(
        "rust-toolchain.toml",
        "channel",
        &pins.rust,
        &pin.toolchain.channel,
    );
    for component in ["rustfmt", "clippy"] {
        if !pin
            .toolchain
            .components
            .iter()
            .any(|value| value == component)
        {
            violations.extend(compare(
                "rust-toolchain.toml",
                "components",
                component,
                "missing",
            ));
        }
    }
    Ok(violations)
}

pub(super) fn package(path: &Path, text: &str, pins: &Pins) -> Result<Vec<Violation>> {
    let pin: PackagePin = serde_json::from_str(text).context("parse package toolchain pins")?;
    let npm = format!("npm@{}", pins.npm);
    let path = path.to_string_lossy();
    let mut violations = compare(&path, "packageManager", &npm, &pin.package_manager);
    if path == "package.json" {
        let actual = pin
            .dev_dependencies
            .get("tar")
            .map(String::as_str)
            .unwrap_or("missing");
        violations.extend(compare(&path, "devDependencies.tar", &pins.tar, actual));
    }
    Ok(violations)
}

#[cfg(test)]
#[path = "_tests_/pins_tests.rs"]
mod pins_tests;
