//! Deterministic multi-pass move detection over rendered evidence.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::review_affected::ReviewSide;

use crate::error::Result;
use crate::move_candidates::Candidates;
use crate::move_similarity;
use crate::move_types::{MoveDetector, MoveEvidence, Pairing};

/// The common move policy. It never uses Git rename scores as entry evidence.
pub struct Detector;

impl MoveDetector for Detector {
    fn pair(
        &self,
        before: &CatalogueModel,
        after: &CatalogueModel,
        evidence: &dyn MoveEvidence,
    ) -> Result<Pairing> {
        let mut state = Candidates::new(before, after);
        declared(&mut state);
        loop {
            let old = state.result.moves.len();
            identical(&mut state, evidence)?;
            if state.result.moves.len() == old {
                break;
            }
        }
        source_title(&mut state);
        move_similarity::apply(&mut state, evidence)?;
        Ok(state.finish())
    }
}

fn declared(state: &mut Candidates<'_>) {
    let removed: BTreeMap<_, _> = state
        .removed
        .iter()
        .map(|index| {
            let entry = &state.before.entries[*index];
            (
                (
                    entry.content.kind(),
                    entry.metadata.path.to_ascii_lowercase(),
                ),
                *index,
            )
        })
        .collect();
    let mut edges = Vec::new();
    for index in state.added.clone() {
        let entry = &state.after.entries[index];
        let Some(previous) = &entry.metadata.moved_from else {
            continue;
        };
        if let Some(left) = removed.get(&(entry.content.kind(), previous.to_ascii_lowercase()))
            && state.eligible(*left, index)
        {
            edges.push((*left, index));
        } else {
            state.result.diagnostics.push(format!(
                "{}: movedFrom {previous} matched no removed base entry of kind {}",
                entry.metadata.path,
                entry.content.kind().as_str()
            ));
            state.blocked_after.insert(index);
        }
    }
    state.admit(edges);
    state.children(true);
}

fn identical(state: &mut Candidates<'_>, evidence: &dyn MoveEvidence) -> Result<()> {
    let paths = state.result.paths(state.before, state.after);
    let mut before = BTreeMap::new();
    let mut after = BTreeMap::new();
    for index in &state.removed {
        if !state.blocked_before.contains(index) {
            before.insert(
                *index,
                evidence.signature(ReviewSide::Before, *index, &paths)?,
            );
        }
    }
    for index in &state.added {
        if !state.blocked_after.contains(index) {
            after.insert(
                *index,
                evidence.signature(ReviewSide::After, *index, &paths)?,
            );
        }
    }
    let mut groups: BTreeMap<_, Vec<usize>> = BTreeMap::new();
    let mut ordinary: BTreeMap<_, Vec<usize>> = BTreeMap::new();
    let mut ignores: BTreeMap<_, Vec<usize>> = BTreeMap::new();
    for (index, signature) in &before {
        let entry = &state.before.entries[*index];
        let role = entry.metadata.variant_of.is_some();
        groups
            .entry((entry.content.kind(), role, signature.hash.clone()))
            .or_default()
            .push(*index);
        ordinary
            .entry((entry.content.kind(), role, signature.unignored_hash.clone()))
            .or_default()
            .push(*index);
        for (id, _) in &signature.ignores {
            ignores
                .entry((entry.content.kind(), role, id.clone()))
                .or_default()
                .push(*index);
        }
    }
    for variants in [false, true] {
        if variants {
            state.children(false);
        }
        let mut edges = Vec::new();
        for (right, signature) in &after {
            if !state.added.contains(right)
                || state.after.entries[*right].metadata.variant_of.is_some() != variants
            {
                continue;
            }
            let kind = state.after.entries[*right].content.kind();
            let mut candidates = groups
                .get(&(kind, variants, signature.hash.clone()))
                .cloned()
                .unwrap_or_default();
            candidates.extend(
                ordinary
                    .get(&(kind, variants, signature.unignored_hash.clone()))
                    .into_iter()
                    .flatten()
                    .filter(|index| before[index].ignores != signature.ignores)
                    .copied(),
            );
            for (id, _) in &signature.ignores {
                candidates.extend(
                    ignores
                        .get(&(kind, variants, id.clone()))
                        .into_iter()
                        .flatten()
                        .filter(|index| before[index].ignores != signature.ignores)
                        .copied(),
                );
            }
            candidates.sort_unstable();
            candidates.dedup();
            for left in candidates {
                if state.removed.contains(&left)
                    && state.eligible(left, *right)
                    && evidence.equal(left, *right, &paths)?
                {
                    edges.push((left, *right));
                }
            }
        }
        state.admit(edges);
    }
    state.children(false);
    Ok(())
}

fn source_title(state: &mut Candidates<'_>) {
    for variants in [false, true] {
        if variants {
            state.children(false);
        }
        let mut groups: BTreeMap<_, Vec<_>> = BTreeMap::new();
        for left in &state.removed {
            let entry = &state.before.entries[*left];
            if entry.content.kind() != EntryKind::Document {
                groups
                    .entry((
                        entry.content.kind(),
                        entry.metadata.source.path.as_str(),
                        entry.metadata.title.as_str(),
                    ))
                    .or_default()
                    .push(*left);
            }
        }
        let mut edges = Vec::new();
        for right in &state.added {
            let entry = &state.after.entries[*right];
            if entry.metadata.variant_of.is_some() != variants {
                continue;
            }
            for left in groups
                .get(&(
                    entry.content.kind(),
                    entry.metadata.source.path.as_str(),
                    entry.metadata.title.as_str(),
                ))
                .into_iter()
                .flatten()
            {
                if state.eligible(*left, *right) {
                    edges.push((*left, *right));
                }
            }
        }
        state.admit(edges);
    }
    state.children(false);
}

#[cfg(test)]
#[path = "_tests_/moves_tests.rs"]
mod moves_tests;
