//! Report actual head imports that a later Git base cannot load.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write;
use std::path::Path;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::{ResolvedConfig, SourcePackage};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_css::dependencies::ImportKind;
use mokly_css::resolution::Resolution;
use mokly_git::identity::RepoPath;
use mokly_git::repository::{Repository, WorkingPathStatus};
use mokly_graph::comparison_input::ModuleImports;
use mokly_graph::types::RenderGeneration;

use crate::error::{Error, GitResult, Result};

pub(crate) fn warnings(
    repository: &dyn Repository,
    config: &ResolvedConfig,
    head: &dyn RenderGeneration,
) -> Result<Vec<Warning>> {
    let Some(imports) = head.module_imports() else {
        return Ok(Vec::new());
    };
    let loaded = loaded_paths(&imports);
    let resolution = working_layout(config);
    let root = &config.repo_root;
    let packages: BTreeMap<_, _> = loaded
        .iter()
        .filter(|(_, kind)| **kind == ImportKind::NodePackage)
        .map(|(&path, _)| {
            let named = root.join(path);
            let target = imports
                .tree
                .project(&named)
                .ok()
                .flatten()
                .and_then(|node| {
                    let target = relative(&node.identity, root);
                    (target != path && repository_path(&target).is_some()).then_some(target)
                });
            let source = resolution
                .workspace_source(imports.tree, root, &named)
                .map(|source| relative(&source, root));
            (path, PackagePaths { target, source })
        })
        .collect();
    let candidates: BTreeSet<_> = loaded
        .keys()
        .copied()
        .chain(packages.values().flat_map(|paths| {
            [paths.target.as_deref(), paths.source.as_deref()]
                .into_iter()
                .flatten()
        }))
        .collect();
    let (names, paths): (Vec<_>, Vec<_>) = candidates
        .into_iter()
        .filter_map(|path| repository_path(path).map(|query| (path, query)))
        .unzip();
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let statuses = match repository.working_path_statuses(&paths).base() {
        Ok(statuses) => names.into_iter().zip(statuses).collect::<BTreeMap<_, _>>(),
        Err(Error::Cancelled) => return Err(Error::Cancelled),
        Err(error) => {
            tracing::debug!(%error, "ignored module check could not read Git's working path statuses");
            return Ok(Vec::new());
        }
    };
    let subject = WarningSubject::Configuration(
        config
            .file
            .strip_prefix(&config.repo_root)
            .ok()
            .or_else(|| config.file.file_name().map(Path::new))
            .unwrap_or_else(|| Path::new("mokly.config.json"))
            .to_string_lossy()
            .replace('\\', "/"),
    );
    let mut warnings = BTreeMap::new();
    for (named, kind) in loaded {
        let package = packages.get(named);
        if let Some(source) = package.and_then(|paths| paths.source.as_deref())
            && matches!(
                statuses.get(source),
                Some(WorkingPathStatus::Tracked | WorkingPathStatus::Untracked)
            )
        {
            continue;
        }
        let target = package.and_then(|paths| paths.target.as_deref());
        for path in std::iter::once(named).chain(target) {
            warnings
                .entry(path)
                .and_modify(|present: &mut (ImportKind, &str)| {
                    if kind > present.0 {
                        *present = (kind, named);
                    }
                })
                .or_insert((kind, named));
        }
    }
    Ok(warnings
        .into_iter()
        .filter_map(|(path, (kind, named))| {
            let status = statuses.get(path)?;
            let reason = match status {
                WorkingPathStatus::Tracked | WorkingPathStatus::Untracked => return None,
                WorkingPathStatus::Ignored => "is ignored by Git".to_owned(),
                WorkingPathStatus::NestedRepository(directory) => {
                    format!(
                        "is inside the nested repository {}",
                        escape_controls(directory.as_str())
                    )
                }
                WorkingPathStatus::Submodule(directory) => {
                    format!(
                        "is inside the submodule {}",
                        escape_controls(directory.as_str())
                    )
                }
            };
            let mut message = format!(
                "module {} {reason}, so a later base cannot load it",
                escape_controls(path)
            );
            if *status == WorkingPathStatus::Ignored
                && matches!(kind, ImportKind::Package | ImportKind::NodePackage)
                && let Some(package) =
                    resolution.workspace_override_hint(imports.tree, root, &root.join(named))
            {
                message.push_str("; set moduleResolution.sourcePackages for ");
                message.push_str(&escape_controls(&package));
            }
            Some(Warning {
                code: "ignored-module",
                subject: subject.clone(),
                message,
            })
        })
        .collect())
}

struct PackagePaths {
    target: Option<String>,
    source: Option<String>,
}

fn repository_path(path: &str) -> Option<RepoPath> {
    if Path::new(path).is_absolute() || path.split('/').any(|part| part == "node_modules") {
        return None;
    }
    RepoPath::parse(path).ok()
}

fn loaded_paths<'a>(imports: &ModuleImports<'a>) -> BTreeMap<&'a str, ImportKind> {
    let javascript = imports.javascript.into_iter().flat_map(|generation| {
        generation.modules.values().flatten().map(|path| {
            let kind = if generation.package_imports.contains(path) {
                ImportKind::Package
            } else {
                ImportKind::File
            };
            (path, kind)
        })
    });
    let stylesheets = imports
        .stylesheet_inputs
        .iter()
        .map(|(path, kind)| (path, *kind));
    let mut paths = BTreeMap::<_, ImportKind>::new();
    for (path, kind) in javascript.chain(stylesheets) {
        if repository_path(path).is_some() {
            paths
                .entry(path.as_str())
                .and_modify(|current| *current = (*current).max(kind))
                .or_insert(kind);
        }
    }
    paths
}

fn working_layout(config: &ResolvedConfig) -> Resolution {
    let source_packages = config.source_packages().map(|entries| {
        entries
            .iter()
            .map(|(name, entry)| {
                let folders = match entry {
                    SourcePackage::Disabled => None,
                    SourcePackage::Folders(folders) => Some(folders.clone()),
                };
                (name.clone(), folders)
            })
            .collect()
    });
    Resolution {
        extensions: config
            .input
            .module_resolution
            .as_ref()
            .and_then(|options| options.resolve_extensions.clone())
            .unwrap_or_default(),
        source_packages: source_packages.into_iter().collect(),
        ..Resolution::default()
    }
}

fn escape_controls(value: &str) -> String {
    let mut escaped = String::new();
    for character in value.chars() {
        if character.is_control() {
            let _ = write!(escaped, "\\u{:04x}", u32::from(character));
        } else {
            escaped.push(character);
        }
    }
    escaped
}
