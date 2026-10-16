//! Document and page moves use mutual unique best line similarity.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;

use crate::error::Result;
use crate::move_candidates::Candidates;
use crate::move_types::MoveEvidence;

pub(crate) fn apply(state: &mut Candidates<'_>, evidence: &dyn MoveEvidence) -> Result<()> {
    if !state
        .removed
        .iter()
        .any(|index| !state.blocked_before.contains(index))
        || !state
            .added
            .iter()
            .any(|index| !state.blocked_after.contains(index))
    {
        return Ok(());
    }
    let paths = state.result.paths(state.before, state.after);
    let mut scores = Vec::new();
    for left in &state.removed {
        for right in &state.added {
            if !state.eligible(*left, *right) {
                continue;
            }
            if !matches!(
                state.before.entries[*left].content.kind(),
                EntryKind::Document | EntryKind::Page
            ) {
                continue;
            }
            let Some(lines) = evidence.lines(*left, *right, &paths)? else {
                continue;
            };
            let score = similarity(&lines.before, &lines.after);
            if score >= 0.5 {
                scores.push((*left, *right, score));
            }
        }
    }
    let mut best_left: BTreeMap<usize, f64> = BTreeMap::new();
    let mut best_right: BTreeMap<usize, f64> = BTreeMap::new();
    for (left, right, score) in &scores {
        best_left
            .entry(*left)
            .and_modify(|old| *old = old.max(*score))
            .or_insert(*score);
        best_right
            .entry(*right)
            .and_modify(|old| *old = old.max(*score))
            .or_insert(*score);
    }
    let mut left_ties: BTreeMap<usize, usize> = BTreeMap::new();
    let mut right_ties: BTreeMap<usize, usize> = BTreeMap::new();
    for (left, right, score) in &scores {
        if best_left.get(left) == Some(score) {
            *left_ties.entry(*left).or_default() += 1;
        }
        if best_right.get(right) == Some(score) {
            *right_ties.entry(*right).or_default() += 1;
        }
    }
    let ambiguous = scores
        .iter()
        .filter(|(left, right, score)| {
            (best_left.get(left) == Some(score)
                && left_ties.get(left).is_some_and(|count| *count > 1))
                || (best_right.get(right) == Some(score)
                    && right_ties.get(right).is_some_and(|count| *count > 1))
        })
        .map(|(left, right, _)| (*left, *right))
        .collect();
    state.admit(ambiguous);
    let edges = scores
        .into_iter()
        .filter(|(left, right, score)| {
            best_left.get(left) == Some(score)
                && best_right.get(right) == Some(score)
                && state.eligible(*left, *right)
        })
        .map(|(left, right, _)| (left, right))
        .collect();
    state.admit(edges);
    Ok(())
}

/// Multiset line overlap. Empty author content proves no move.
pub fn similarity(before: &[String], after: &[String]) -> f64 {
    if before.is_empty() || after.is_empty() {
        return 0.0;
    }
    let mut counts = BTreeMap::new();
    for line in before {
        *counts.entry(line).or_insert(0usize) += 1;
    }
    let mut shared = 0usize;
    for line in after {
        if let Some(count) = counts.get_mut(line)
            && *count > 0
        {
            *count -= 1;
            shared += 1;
        }
    }
    (2 * shared) as f64 / (before.len() + after.len()) as f64
}
