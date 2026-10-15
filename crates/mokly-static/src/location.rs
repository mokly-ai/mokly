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
        if let Some(roots) = config
            .input
            .module_resolution
            .as_ref()
            .and_then(|settings| settings.package_roots.as_ref())
        {
            for root in roots {
                inputs.push(
                    config
                        .file
                        .parent()
                        .unwrap_or(&config.repo_root)
                        .join(root)
                        .join("package.json"),
                );
            }
        }
        Self {
            allowed,
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
    if !lexical.is_absolute()
        || lexical == boundary.allowed
        || !lexical.starts_with(&boundary.allowed)
        || real == allowed
        || !real.starts_with(&allowed)
        || matches!(files.entry(&lexical)?, Some(Entry::Unsafe | Entry::File(_)))
    {
        return Err(Error::Destination {
            path: lexical.clone(),
        });
    }
    for path in [&lexical, &real] {
        if path
            .strip_prefix(&allowed)
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
    match files.entry(path)? {
        Some(Entry::Directory(_)) => Ok(()),
        Some(_) => Err(Error::Unexpected { path: path.into() }),
        None => {
            if let Some(parent) = path.parent() {
                directories(files, parent)?;
            }
            match files.mkdir(path) {
                Ok(()) => Ok(()),
                Err(_) if matches!(files.entry(path)?, Some(Entry::Directory(_))) => Ok(()),
                Err(error) => Err(error),
            }
        }
    }
}
