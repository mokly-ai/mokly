//! Lexical and projected output boundaries pinned for the whole transaction.

use std::path::{Component, Path, PathBuf};

use mokly_catalogue::config_types::ResolvedConfig;

use crate::error::{Error, Result};
use crate::filesystem::{Entry, Files};

/// Source and runtime locations that no output may replace.
#[derive(Clone, Debug)]
pub struct Boundary {
    /// Repository root for build, private parent for publish.
    pub allowed: PathBuf,
    /// Lexical spelling of the allowed root when reached through an alias.
    pub lexical_allowed: Option<PathBuf>,
    /// Source roots cannot contain or be contained by an output.
    pub roots: Vec<PathBuf>,
    /// Inventoried inputs and package runtime paths cannot be contained by output.
    pub inputs: Vec<PathBuf>,
}

impl Boundary {
    /// Initial protections before catalogue preparation adds its complete input set.
    pub fn catalogue(config: &ResolvedConfig, allowed: PathBuf) -> Self {
        let mut inputs = config.authored_inputs.clone();
        inputs.push(config.file.clone());
        inputs.push(config.repo_root.join("package.json"));
        for root in config.package_roots() {
            inputs.push(config.repo_root.join(root).join("package.json"));
        }
        Self {
            allowed,
            lexical_allowed: None,
            roots: config
                .roots
                .iter()
                .flat_map(|root| [root.directory.clone(), root.identity.clone()])
                .collect(),
            inputs,
        }
    }
}

/// Resolve --out against the configuration directory; the default uses the repository.
pub fn output(config: &ResolvedConfig, requested: Option<&str>) -> PathBuf {
    normalize(&requested.map_or_else(
        || config.repo_root.join("mokly-static"),
        |path| config.file.parent().unwrap_or(&config.repo_root).join(path),
    ))
}

pub(crate) fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                result.pop();
            }
            other => result.push(other),
        }
    }
    result
}

pub(crate) fn validate(
    files: &dyn Files,
    requested: &Path,
    boundary: &Boundary,
) -> Result<PathBuf> {
    let lexical = normalize(requested);
    let real = files.project(&lexical)?;
    let allowed = files.project(&boundary.allowed)?;
    let lexical_allowed = boundary
        .lexical_allowed
        .as_ref()
        .unwrap_or(&boundary.allowed);
    if !lexical.is_absolute()
        || lexical == *lexical_allowed
        || !lexical.starts_with(lexical_allowed)
        || real == allowed
        || !real.starts_with(&allowed)
        || matches!(files.entry(&lexical)?, Some(Entry::Unsafe | Entry::File(_)))
    {
        return Err(Error::Destination {
            path: lexical.clone(),
        });
    }
    for (path, allowed_root) in [(&lexical, lexical_allowed), (&real, &allowed)] {
        if path
            .strip_prefix(allowed_root)
            .unwrap_or(path)
            .components()
            .any(|part| {
                matches!(
                    part.as_os_str().to_str(),
                    Some(".git" | "node_modules" | ".mokly-export-reservations")
                )
            })
        {
            return Err(Error::Destination {
                path: lexical.clone(),
            });
        }
        for root in &boundary.roots {
            let projected = files.project(root)?;
            if [root, &projected]
                .iter()
                .any(|root| path.starts_with(root) || root.starts_with(path))
            {
                return Err(Error::Destination {
                    path: lexical.clone(),
                });
            }
        }
        for input in &boundary.inputs {
            if input.starts_with(path) || files.project(input)?.starts_with(path) {
                return Err(Error::Destination {
                    path: lexical.clone(),
                });
            }
        }
    }
    Ok(real)
}

pub(crate) fn directories(files: &dyn Files, path: &Path) -> Result<()> {
    let mut missing = Vec::new();
    let mut next = Some(path);
    while let Some(path) = next {
        match files.entry(path)? {
            Some(Entry::Directory(_)) => break,
            Some(_) => return Err(Error::Unexpected { path: path.into() }),
            None => missing.push(path),
        }
        next = path.parent();
    }
    for path in missing.into_iter().rev() {
        match files.mkdir(path) {
            Ok(()) => {}
            Err(_) if matches!(files.entry(path)?, Some(Entry::Directory(_))) => {}
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/catalogue_boundary_tests.rs"]
mod catalogue_boundary_tests;
