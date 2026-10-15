//! Resolve complete and relative catalogue paths and reciprocal flow membership.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{EntryContent, EntryMetadata, ModelEntry};
use mokly_model::paths::is_entry_path;

use crate::diagnostic::{Code, Issue};
use crate::identity::location;

pub(crate) fn base(metadata: &EntryMetadata, entries: &[ModelEntry]) -> String {
    let metadata = metadata
        .variant_of
        .as_deref()
        .and_then(|path| entries.iter().find(|entry| entry.metadata.path == path))
        .map_or(metadata, |parent| &parent.metadata);
    if metadata.is_index {
        metadata.path.clone()
    } else {
        metadata
            .path
            .rsplit_once('/')
            .map_or("", |(parent, _)| parent)
            .into()
    }
}

pub(crate) fn resolve(target: &str, base: &str) -> Option<String> {
    let resolved = if target.starts_with("./") || target.starts_with("../") {
        let mut segments: Vec<_> = if base.is_empty() {
            Vec::new()
        } else {
            base.split('/').collect()
        };
        for part in target.split('/') {
            match part {
                "." => {}
                ".." => {
                    segments.pop()?;
                }
                "" => return None,
                _ => segments.push(part),
            }
        }
        segments.join("/")
    } else {
        target.into()
    };
    is_entry_path(&resolved).then_some(resolved)
}

pub(crate) fn validate(entries: &mut [ModelEntry]) -> Vec<Issue> {
    let originals = entries.to_vec();
    let lookup: BTreeMap<_, _> = originals
        .iter()
        .map(|entry| (entry.metadata.path.to_ascii_lowercase(), entry))
        .collect();
    let mut issues = Vec::new();
    for entry in entries.iter_mut() {
        let folder = base(&entry.metadata, &originals);
        let paths: Vec<(&mut String, EntryKind)> = match &mut entry.content {
            EntryContent::Screen { use_case_paths, .. } => use_case_paths
                .iter_mut()
                .map(|path| (path, EntryKind::UseCase))
                .collect(),
            EntryContent::UseCase { steps } => steps
                .iter_mut()
                .map(|step| (&mut step.screen_path, EntryKind::Screen))
                .collect(),
            _ => Vec::new(),
        };
        for (path, kind) in paths {
            let target = resolve(path, &folder)
                .and_then(|path| lookup.get(&path.to_ascii_lowercase()).copied())
                .filter(|target| target.content.kind() == kind);
            if let Some(target) = target {
                *path = target.metadata.path.clone();
            } else {
                issues.push(
                    Issue::new(
                        Code::InvalidMetadata,
                        format!(
                            "{}: {} target {path} does not name a current {}",
                            location(&entry.metadata.source),
                            entry.metadata.path,
                            kind.as_str()
                        ),
                    )
                    .at(entry.metadata.source.clone()),
                );
            }
        }
    }
    let memberships: BTreeMap<_, BTreeSet<_>> = entries
        .iter()
        .filter_map(|entry| {
            if let EntryContent::Screen { use_case_paths, .. } = &entry.content {
                Some((
                    entry.metadata.path.as_str(),
                    use_case_paths.iter().map(String::as_str).collect(),
                ))
            } else {
                None
            }
        })
        .collect();
    let flows: BTreeMap<_, BTreeSet<_>> = entries
        .iter()
        .filter_map(|entry| {
            if let EntryContent::UseCase { steps } = &entry.content {
                Some((
                    entry.metadata.path.as_str(),
                    steps.iter().map(|step| step.screen_path.as_str()).collect(),
                ))
            } else {
                None
            }
        })
        .collect();
    for (screen, flow_paths) in &memberships {
        for flow in flow_paths {
            if flows.get(flow).is_some_and(|steps| !steps.contains(screen)) {
                issues.push(Issue::new(Code::InvalidMetadata,format!("screen {screen} lists use case {flow}, but its steps do not name the screen")));
            }
        }
    }
    for (flow, steps) in &flows {
        for screen in steps {
            if memberships
                .get(screen)
                .is_some_and(|paths| !paths.contains(flow))
            {
                issues.push(Issue::new(Code::InvalidMetadata,format!("use case {flow} steps through screen {screen}, but the screen does not list the use case")));
            }
        }
    }
    issues
}

pub(crate) fn link(target: &str, source: &EntryMetadata, entries: &[ModelEntry]) -> Option<Issue> {
    let target = target.split('#').next().unwrap_or(target);
    let resolved = resolve(target, &base(source, entries)).unwrap_or_else(|| target.into());
    if entries
        .iter()
        .any(|entry| entry.metadata.path.eq_ignore_ascii_case(&resolved))
    {
        return None;
    }
    let moved = entries.iter().find(|entry| {
        entry
            .metadata
            .moved_from
            .as_deref()
            .is_some_and(|path| path.eq_ignore_ascii_case(&resolved))
    });
    Some(
        if let Some(moved) = moved {
            Issue::new(
                Code::MovedLinkTarget,
                format!(
                    "{}: link target {resolved} does not exist; it moved to {}",
                    location(&source.source),
                    moved.metadata.path
                ),
            )
        } else {
            Issue::new(
                Code::UnknownLinkTarget,
                format!(
                    "{}: link target {resolved} does not exist",
                    location(&source.source)
                ),
            )
        }
        .at(source.source.clone()),
    )
}
