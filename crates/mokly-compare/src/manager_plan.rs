//! Locked install roots selected from configuration and package ancestors.

use crate::ancestor_roots;
use crate::error::{Error, Result};
use crate::inputs::Inputs;
use crate::local_packages;
use crate::manager::{Manager, Root, version_major};
use crate::manager_yaml;

pub(crate) fn roots(inputs: &Inputs, configured: &[String]) -> Result<Vec<Root>> {
    let manifests = local_packages::manifests(&inputs.files)?;
    let mut roots = Vec::new();
    for directory in directories(configured) {
        if ![
            "npm-shrinkwrap.json",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
            "bun.lock",
            "bun.lockb",
        ]
        .iter()
        .any(|name| file(inputs, &directory, name).is_some())
        {
            continue;
        }
        if !manifests.contains_key(&directory) {
            return Err(Error::UnsupportedManager);
        }
        let pin = manifests
            .get(&directory)
            .and_then(|manifest| manifest.package_manager.as_deref());
        let mut manager = if file(inputs, &directory, "npm-shrinkwrap.json").is_some()
            || file(inputs, &directory, "package-lock.json").is_some()
        {
            Manager::Npm
        } else if file(inputs, &directory, "pnpm-lock.yaml").is_some() {
            Manager::Pnpm
        } else {
            yarn(inputs, &directory)?
        };
        let mut requested = None;
        if let Some(pin) = pin {
            let Some((name, version)) = pin.split_once('@') else {
                return Err(Error::UnsupportedVersion);
            };
            let version = version.split('+').next().unwrap_or("");
            manager = match name {
                "npm" => Manager::Npm,
                "pnpm" => Manager::Pnpm,
                "yarn" => match version_major(version) {
                    Some(1) => Manager::YarnClassic,
                    Some(4) => Manager::YarnBerry,
                    _ => return Err(Error::UnsupportedVersion),
                },
                _ => return Err(Error::UnsupportedManager),
            };
            if manager != Manager::Npm {
                if !manager.supports(version) {
                    return Err(Error::UnsupportedVersion);
                }
                requested = Some(version.to_owned());
            }
        }
        let lock = match manager {
            Manager::Npm => file(inputs, &directory, "npm-shrinkwrap.json")
                .or_else(|| file(inputs, &directory, "package-lock.json")),
            Manager::Pnpm => file(inputs, &directory, "pnpm-lock.yaml"),
            Manager::YarnClassic | Manager::YarnBerry => {
                if yarn(inputs, &directory)? != manager {
                    return Err(Error::UnsupportedVersion);
                }
                file(inputs, &directory, "yarn.lock")
            }
        };
        if lock.is_none() {
            return Err(Error::UnsupportedManager);
        }
        roots.push(Root {
            directory,
            manager,
            requested,
            version: String::new(),
        });
    }
    if roots.is_empty() {
        return Err(Error::UnsupportedManager);
    }
    Ok(roots)
}

pub(crate) fn directories(configured: &[String]) -> Vec<String> {
    let mut candidates = vec![String::new()];
    for configured in configured {
        for directory in ancestor_roots::directories(configured) {
            if !candidates.contains(&directory) {
                candidates.push(directory);
            }
        }
    }
    candidates
}

fn yarn(inputs: &Inputs, root: &str) -> Result<Manager> {
    let Some(lock) = file(inputs, root, "yarn.lock") else {
        return Err(Error::UnsupportedManager);
    };
    if lock
        .split(|byte| *byte == b'\n')
        .any(|line| line.trim_ascii() == b"# yarn lockfile v1")
    {
        return Ok(Manager::YarnClassic);
    }
    if !manager_yaml::fields(lock, &path(root, "yarn.lock"))?.contains_key("__metadata") {
        return Err(Error::UnsupportedManager);
    }
    match berry_linker(inputs, root)?.as_deref() {
        Some("node-modules") => {}
        None | Some("pnp") => return Err(Error::YarnPnp),
        _ => return Err(Error::UnsupportedManager),
    }
    Ok(Manager::YarnBerry)
}

fn berry_linker(inputs: &Inputs, root: &str) -> Result<Option<String>> {
    let mut linker = None;
    for directory in ancestor_roots::directories(root) {
        let Some(bytes) = file(inputs, &directory, ".yarnrc.yml") else {
            continue;
        };
        let path = path(&directory, ".yarnrc.yml");
        let config = manager_yaml::fields(bytes, &path)?;
        if config.contains_key("plugins") || config.contains_key("networkSettings") {
            return Err(Error::InvalidInput { path });
        }
        if linker.is_none()
            && let Some(value) = config.get("nodeLinker")
        {
            linker = Some(value.clone().ok_or(Error::InvalidInput { path })?);
        }
    }
    Ok(linker)
}

fn file<'a>(inputs: &'a Inputs, root: &str, name: &str) -> Option<&'a [u8]> {
    let path = path(root, name);
    inputs
        .files
        .iter()
        .find(|(candidate, _)| candidate.as_str() == path)
        .map(|(_, bytes)| bytes.as_slice())
}

fn path(root: &str, name: &str) -> String {
    if root.is_empty() {
        name.to_owned()
    } else {
        format!("{root}/{name}")
    }
}
