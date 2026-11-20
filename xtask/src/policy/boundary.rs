//! Enforce the MIT boundary with Cargo metadata and npm import resolution.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;

use crate::command::CommandSpec;
use crate::error::{ErrorResultExt, Result, reject};

use super::diagnostic::Violation;
use super::environment::Environment;

#[derive(Deserialize)]
struct Metadata {
    packages: Vec<Package>,
}

#[derive(Deserialize)]
struct Package {
    name: String,
    manifest_path: PathBuf,
    dependencies: Vec<Dependency>,
}

#[derive(Deserialize)]
struct Dependency {
    name: String,
}

pub(super) struct BoundaryCheck {
    pub(super) environment: Arc<dyn Environment>,
}

impl BoundaryCheck {
    pub(super) fn check(&self) -> Result<()> {
        let metadata = self.environment.output(&CommandSpec::new("cargo").args([
            "metadata",
            "--no-deps",
            "--format-version=1",
            "--locked",
        ]))?;
        reject(validate(&metadata)?)?;
        self.environment
            .output(&CommandSpec::new("node").args(["xtask/scripts/boundary-imports.mjs"]))?;
        Ok(())
    }
}

fn validate(metadata: &str) -> Result<Vec<Violation>> {
    let metadata: Metadata =
        serde_json::from_str(metadata).context("parse Cargo boundary metadata")?;
    let mut violations = Vec::new();
    for package in metadata.packages {
        if package.name != "xtask" && !package.name.starts_with("mokly-") {
            continue;
        }
        for dependency in package.dependencies {
            if dependency.name.starts_with("mkc-") {
                violations.push(Violation::CloudDependency {
                    path: package.manifest_path.clone(),
                    dependency: dependency.name,
                });
            }
        }
    }
    Ok(violations)
}

#[cfg(test)]
#[path = "_tests_/boundary_tests.rs"]
mod boundary_tests;
