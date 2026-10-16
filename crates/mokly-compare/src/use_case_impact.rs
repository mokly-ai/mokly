//! Direct screen membership propagates to its exact use-case steps.

use crate::comparison_types::EntryClassification;
use crate::material::mapped;
use crate::move_types::EntryPair;
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{CatalogueModel, EntryContent};
use mokly_model::review::EntryChangeReason;
use std::collections::{BTreeMap, BTreeSet};

pub(crate) fn propagate(
    entries: &mut [EntryClassification],
    pairs: &[EntryPair],
    before: &CatalogueModel,
    after: &CatalogueModel,
    paths: &BTreeMap<String, String>,
) {
    let changed_screens: BTreeSet<_> = entries
        .iter()
        .filter(|entry| entry.kind == EntryKind::Screen && !entry.reasons.is_empty())
        .map(|entry| entry.path.clone())
        .collect();
    for (classification, pair) in entries.iter_mut().zip(pairs) {
        if classification.kind != EntryKind::UseCase {
            continue;
        }
        let mut screens = BTreeSet::new();
        for (catalogue, index, paths) in [
            (before, pair.before, paths),
            (after, pair.after, &BTreeMap::new()),
        ] {
            if let Some(index) = index
                && let EntryContent::UseCase { steps } = &catalogue.entries[index].content
            {
                for step in steps {
                    let path = mapped(&step.screen_path, paths);
                    if changed_screens.contains(&path) {
                        screens.insert(path);
                    }
                }
            }
        }
        if !screens.is_empty() {
            classification.included = true;
            classification.reasons.extend(
                screens
                    .into_iter()
                    .map(|screen_path| EntryChangeReason::Screen { screen_path }),
            );
        }
    }
}
