//! Similarity source lines use the paired page projection or private Markdown bodies.

use std::collections::BTreeMap;

use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::EntryContent;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::error::Result;
use crate::move_context::RenderedMoves;
use crate::move_types::MoveLines;
use crate::{material, move_text, view_material};

impl RenderedMoves<'_> {
    pub(crate) fn author_lines(
        &self,
        before: usize,
        after: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<Option<MoveLines>> {
        let left = &self.before.catalogue().model.entries[before];
        let right = &self.after.catalogue().model.entries[after];
        match (&left.content, &right.content) {
            (EntryContent::Document { .. }, EntryContent::Document { .. }) => {
                let (Some(before), Some(after)) = (
                    self.before.catalogue().documents.get(&left.metadata.path),
                    self.after.catalogue().documents.get(&right.metadata.path),
                ) else {
                    return Ok(None);
                };
                let lines = |body: &str| {
                    body.lines()
                        .map(|line| line.trim_end().to_owned())
                        .collect()
                };
                Ok(Some(MoveLines {
                    before: lines(before),
                    after: lines(after),
                }))
            }
            (EntryContent::Page, EntryContent::Page) => {
                let plans = [
                    self.plans(ReviewSide::Before, before),
                    self.plans(ReviewSide::After, after),
                ];
                let routes = plans.each_ref().map(|plans| {
                    plans
                        .iter()
                        .find(|(key, _)| key.color_scheme == ColorScheme::Light)
                        .map(|(_, plan)| &plan.route)
                });
                let [Some(before_route), Some(after_route)] = routes else {
                    return Ok(None);
                };
                let before = self.before.comparison_document(before_route).compare()?;
                let after = self.after.comparison_document(after_route).compare()?;
                let (Some(before), Some(after)) = (&before.document, &after.document) else {
                    return Ok(None);
                };
                let (left, right) = view_material::projections(
                    before,
                    after,
                    before_route,
                    after_route,
                    paths,
                    &BTreeMap::new(),
                );
                Ok(Some(MoveLines {
                    before: move_text::page(&material::canonical(&before.tree, &left)),
                    after: move_text::page(&material::canonical(&after.tree, &right)),
                }))
            }
            _ => Ok(None),
        }
    }
}
