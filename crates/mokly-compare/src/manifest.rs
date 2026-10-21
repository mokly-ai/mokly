//! Npm manifest values and all local dependency forms, including overrides.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::error::{Error, Result};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Manifest {
    pub(crate) package_manager: Option<String>,
    #[serde(default)]
    dependencies: BTreeMap<String, String>,
    #[serde(default)]
    dev_dependencies: BTreeMap<String, String>,
    #[serde(default)]
    optional_dependencies: BTreeMap<String, String>,
    #[serde(default)]
    overrides: BTreeMap<String, Override>,
    #[serde(default)]
    resolutions: BTreeMap<String, String>,
    #[serde(default)]
    pnpm: Pnpm,
    workspaces: Option<Workspaces>,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pnpm {
    #[serde(default)]
    overrides: BTreeMap<String, Override>,
    #[serde(default)]
    patched_dependencies: BTreeMap<String, String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Override {
    Version(String),
    Nested(BTreeMap<String, Override>),
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Workspaces {
    List(Vec<String>),
    Object { packages: Vec<String> },
}

impl Manifest {
    pub(crate) fn local(&self) -> bool {
        self.workspaces.is_some()
            || !self.pnpm.patched_dependencies.is_empty()
            || self
                .specifications()
                .iter()
                .any(|value| value.starts_with("patch:") || local(value).is_some())
    }

    pub(crate) fn patches(&self) -> impl Iterator<Item = &str> {
        self.pnpm.patched_dependencies.values().map(String::as_str)
    }

    pub(crate) fn packages(&self) -> impl Iterator<Item = (&String, &String)> {
        self.dependencies
            .iter()
            .chain(self.dev_dependencies.iter())
            .chain(self.optional_dependencies.iter())
    }

    pub(crate) fn workspaces(&self) -> &[String] {
        match &self.workspaces {
            Some(Workspaces::List(values) | Workspaces::Object { packages: values }) => values,
            None => &[],
        }
    }

    pub(crate) fn specifications(&self) -> Vec<&str> {
        let mut values = self
            .packages()
            .map(|(_, value)| value.as_str())
            .collect::<Vec<_>>();
        values.extend(self.resolutions.values().map(String::as_str));
        let mut pending = self
            .overrides
            .values()
            .chain(self.pnpm.overrides.values())
            .collect::<Vec<_>>();
        while let Some(value) = pending.pop() {
            match value {
                Override::Version(value) => values.push(value),
                Override::Nested(values) => pending.extend(values.values()),
            }
        }
        values
    }
}

pub(crate) fn parse(bytes: &[u8], path: &str) -> Result<Manifest> {
    match serde_json::from_slice(bytes) {
        Ok(manifest) => Ok(manifest),
        Err(_) => Err(Error::InvalidInput {
            path: path.to_owned(),
        }),
    }
}

pub(crate) fn local(value: &str) -> Option<&str> {
    if let Some(value) = value.strip_prefix("portal:") {
        return Some(value);
    }
    if let Some(value) = value.strip_prefix("workspace:") {
        return (value.starts_with(['.', '/', '\\'])
            || value.starts_with("~/")
            || value.as_bytes().get(1) == Some(&b':'))
        .then_some(value);
    }
    if value.get(..5).is_some_and(|prefix| {
        prefix.eq_ignore_ascii_case("file:") || prefix.eq_ignore_ascii_case("link:")
    }) {
        return value.get(5..);
    }
    if value.starts_with(['.', '/', '\\'])
        || value.starts_with("~/")
        || value.as_bytes().get(1) == Some(&b':')
    {
        return Some(value);
    }
    if !value.contains(':')
        && (value.to_ascii_lowercase().ends_with(".tgz")
            || value.to_ascii_lowercase().ends_with(".tar.gz")
            || value.to_ascii_lowercase().ends_with(".tar"))
    {
        return Some(value);
    }
    None
}

pub(crate) fn target(parent: &str, value: &str) -> Result<String> {
    if value.is_empty()
        || value.starts_with(['/', '\\'])
        || value == "~"
        || value.starts_with("~/")
        || value.contains(['\\', ':', '%', '\0'])
    {
        return Err(Error::LocalOutside {
            path: value.to_owned(),
        });
    }
    let mut parts = parent
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    for part in value.split('/') {
        match part {
            ".." => {
                if parts.pop().is_none() {
                    return Err(Error::LocalOutside {
                        path: value.to_owned(),
                    });
                }
            }
            "" | "." => {}
            _ => parts.push(part),
        }
    }
    Ok(parts.join("/"))
}

#[cfg(test)]
#[path = "_tests_/manifest_tests.rs"]
mod manifest_tests;
