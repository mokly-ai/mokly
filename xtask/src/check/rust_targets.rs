//! The test units of the Mokly crates, read from Cargo metadata.
//!
//! A unit is one Cargo target selection, such as `--test cli`, that a test
//! shard passes to nextest beside the complete package selection. Every shard
//! selects the same packages, so Cargo resolves the same dependency features
//! on every shard and the shards share one Rust build cache.

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;

use crate::error::{ErrorResultExt, Result};

/// One Cargo target selection that nextest builds and runs as a whole.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(super) enum TestUnit {
    /// `--lib`: the unit tests of every selected library.
    Libraries,
    /// `--bin NAME`: the unit tests of each selected binary with this name.
    Binary(String),
    /// `--test NAME`: each selected integration test with this name.
    Test(String),
    /// `--example NAME`: each selected example with this name that has tests.
    Example(String),
    /// `--bench NAME`: each selected benchmark with this name that has tests.
    Bench(String),
}

impl TestUnit {
    /// The Cargo target arguments of this unit.
    pub(super) fn args(&self) -> Vec<String> {
        let (flag, name) = match self {
            Self::Libraries => return vec!["--lib".to_owned()],
            Self::Binary(name) => ("--bin", name),
            Self::Test(name) => ("--test", name),
            Self::Example(name) => ("--example", name),
            Self::Bench(name) => ("--bench", name),
        };
        vec![flag.to_owned(), name.clone()]
    }

    /// The unit's arguments joined by a space, the key of its weight.
    pub(super) fn key(&self) -> String {
        self.args().join(" ")
    }
}

#[derive(Deserialize)]
struct Metadata {
    packages: Vec<Package>,
    workspace_members: BTreeSet<String>,
    resolve: Resolve,
}

#[derive(Deserialize)]
struct Package {
    id: String,
    name: String,
    targets: Vec<Target>,
}

#[derive(Deserialize)]
struct Target {
    name: String,
    kind: Vec<String>,
    test: bool,
    #[serde(rename = "required-features", default)]
    required_features: Vec<String>,
}

#[derive(Deserialize)]
struct Resolve {
    nodes: Vec<Node>,
}

/// One resolved package with the features that Cargo enables for it.
#[derive(Deserialize)]
struct Node {
    id: String,
    features: BTreeSet<String>,
    #[serde(default)]
    deps: Vec<NodeDependency>,
}

/// One resolved dependency, by its crate name in the depending package.
#[derive(Deserialize)]
struct NodeDependency {
    name: String,
    pkg: String,
}

/// Whether the package belongs to the `-p "mokly-*" -p xtask` selection.
pub(super) fn is_mokly_package(name: &str) -> bool {
    name == "xtask" || name.starts_with("mokly-")
}

/// Read the units of the targets that `cargo nextest run` selects by default
/// for the Mokly workspace packages: each target that has tests and whose
/// required features Cargo's resolved features enable, also a required
/// `dependency/feature`. The resolved features include features that a
/// dependency or a dev-dependency enables. Build scripts have no tests.
pub(super) fn test_units(metadata: &str) -> Result<BTreeSet<TestUnit>> {
    let metadata: Metadata =
        serde_json::from_str(metadata).context("parse Cargo test target metadata")?;
    let resolved: BTreeMap<&str, &Node> = metadata
        .resolve
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let mut units = BTreeSet::new();
    for package in &metadata.packages {
        if !metadata.workspace_members.contains(&package.id) || !is_mokly_package(&package.name) {
            continue;
        }
        for target in &package.targets {
            let available = target
                .required_features
                .iter()
                .all(|feature| enables(&resolved, &package.id, feature));
            if !target.test || !available {
                continue;
            }
            if let Some(unit) = unit(target) {
                units.insert(unit);
            }
        }
    }
    Ok(units)
}

/// Whether Cargo enables a required feature of one package: a feature of
/// the package itself, or `dependency/feature` of one of its dependencies.
fn enables(resolved: &BTreeMap<&str, &Node>, package: &str, required: &str) -> bool {
    let Some(node) = resolved.get(package) else {
        return false;
    };
    let Some((dependency, feature)) = required.split_once('/') else {
        return node.features.contains(required);
    };
    let crate_name = dependency.trim_end_matches('?').replace('-', "_");
    node.deps
        .iter()
        .find(|dependency| dependency.name == crate_name)
        .and_then(|dependency| resolved.get(dependency.pkg.as_str()))
        .is_some_and(|dependency| dependency.features.contains(feature))
}

fn unit(target: &Target) -> Option<TestUnit> {
    let name = target.name.clone();
    target.kind.iter().find_map(|kind| match kind.as_str() {
        "lib" | "rlib" | "dylib" | "cdylib" | "staticlib" | "proc-macro" => {
            Some(TestUnit::Libraries)
        }
        "bin" => Some(TestUnit::Binary(name.clone())),
        "test" => Some(TestUnit::Test(name.clone())),
        "example" => Some(TestUnit::Example(name.clone())),
        "bench" => Some(TestUnit::Bench(name.clone())),
        _ => None,
    })
}
