//! Additional watch rules contribute content inputs without broadening public files.

use std::collections::{BTreeMap, BTreeSet};

use globset::GlobBuilder;
use mokly_catalogue::config_types::{ResolvedConfig, WatchAction};
use mokly_catalogue::protection::{ProtectedBy, SourcePolicy};
use mokly_model::material::digest;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, Result, invalid};

pub(crate) fn inputs(
    config: &ResolvedConfig,
    tree: &dyn SourceTree,
    sources: &[String],
) -> Result<(String, String)> {
    let mut rules = Vec::new();
    for rule in config
        .input
        .watch
        .as_ref()
        .and_then(|watch| watch.rules.as_ref())
        .into_iter()
        .flatten()
    {
        for pattern in &rule.paths {
            let glob = match GlobBuilder::new(pattern)
                .literal_separator(true)
                .backslash_escape(false)
                .build()
            {
                Ok(glob) => glob.compile_matcher(),
                Err(_) => return Err(invalid(pattern, "watch glob is invalid")),
            };
            rules.push((rule.action, glob));
        }
    }
    if rules.is_empty() {
        return Ok((String::new(), String::new()));
    }
    let policy = match SourcePolicy::new(config, sources) {
        Ok(policy) => policy,
        Err(source) => {
            return Err(InternalError::Provider {
                source: Box::new(source),
            }
            .into());
        }
    };
    let sources: BTreeSet<_> = sources.iter().map(String::as_str).collect();
    let mut rebuild = BTreeMap::new();
    let mut reload = BTreeMap::new();
    let mut pending = vec![config.repo_root.clone()];
    while let Some(directory) = pending.pop() {
        let children = match tree.children(&directory) {
            Ok(children) => children,
            Err(source) if source.is_vanished() => continue,
            Err(_) => return Err(invalid("watch.rules", "watch inputs could not be read")),
        };
        for child in children {
            let path = directory.join(&child.name);
            if child.kind == FileKind::Directory {
                if !matches!(
                    child.name.as_str(),
                    ".git"
                        | "node_modules"
                        | "dist"
                        | "coverage"
                        | "target"
                        | "test-results"
                        | "playwright-report"
                        | ".context"
                        | "mokly-static"
                        | ".mokly-export-reservations"
                ) {
                    pending.push(path);
                }
                continue;
            }
            if child.kind != FileKind::File {
                continue;
            }
            let Ok(relative) = path.strip_prefix(&config.repo_root) else {
                continue;
            };
            let name = relative.to_string_lossy().replace('\\', "/");
            if sources.contains(name.as_str())
                || matches!(
                    policy.denial(&name, None),
                    Some(ProtectedBy::RootMatch { .. })
                )
            {
                continue;
            }
            let Some((action, _)) = rules.iter().find(|(_, glob)| glob.is_match(relative)) else {
                continue;
            };
            let target = match action {
                WatchAction::Ignore => continue,
                WatchAction::Rebuild => &mut rebuild,
                WatchAction::Reload => &mut reload,
            };
            let hash = tree.digest(&path).ok().unwrap_or_default();
            target.insert(name, hash);
        }
    }
    Ok((
        digest(format!("{rebuild:?}").as_bytes()),
        digest(format!("{reload:?}").as_bytes()),
    ))
}

#[cfg(test)]
#[path = "_tests_/watch_rules_tests.rs"]
mod watch_rules_tests;
