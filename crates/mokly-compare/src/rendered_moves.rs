//! Move evidence uses current-version graph documents and exact source-side bytes.

use std::collections::BTreeMap;

use mokly_model::canonical;
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::comparison_resources::closures;
use crate::error::Result;
use crate::material::{self, Projection};
use crate::move_context::RenderedMoves;
use crate::move_types::{MoveEvidence, MoveLines, MoveSignature};
use crate::{instance_inputs, matching_tree, move_fingerprint, owned_styles};
use crate::{material_traits, view_material};

impl MoveEvidence for RenderedMoves<'_> {
    fn signature(
        &self,
        side: ReviewSide,
        index: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<MoveSignature> {
        let generation = self.side(side);
        let entry = &generation.catalogue().model.entries[index];
        let mut views = Vec::new();
        let mut ignored = Vec::new();
        let mut unignored = Vec::new();
        for (key, plan) in self.plans(side, index) {
            let artifact = generation.comparison_document(&plan.route).compare()?;
            let Some(document) = &artifact.document else {
                continue;
            };
            let ignores = material::ignores(&document.tree);
            ignored.extend(material::ignore_contract(&document.tree));
            let instances = material::instances(&document.tree, paths)
                .into_keys()
                .collect();
            let route = format!("static/mokly-generated/{}", plan.route);
            let resources =
                move_fingerprint::resources(generation, self.memo.as_ref(), side, &plan.route)?;
            let mut projection = Projection {
                ignored: ignores,
                instances,
                paths: paths.clone(),
                route,
                resources,
                instance_owner: None,
                inputs: instance_inputs::collect(&document.usage),
            };
            views.push((
                key.viewport,
                key.color_scheme,
                material_traits::fingerprint(&material::canonical(&document.tree, &projection))?,
            ));
            projection.ignored.clear();
            unignored.push((
                key.viewport,
                key.color_scheme,
                material_traits::fingerprint(&material::canonical(&document.tree, &projection))?,
            ));
        }
        let steps = match &entry.content {
            EntryContent::UseCase { steps } => steps
                .iter()
                .map(|step| {
                    (
                        material::mapped(&step.screen_path, paths),
                        &step.title,
                        &step.description,
                    )
                })
                .collect(),
            _ => Vec::new(),
        };
        let extra = match &entry.content {
            EntryContent::Component { visual, slots, .. }
                if entry.metadata.variant_of.is_none() =>
            {
                canonical::to_string(&(&visual.prop_schema, &visual.controls, slots)).compare()?
            }
            _ => String::new(),
        };
        let mut variants = Vec::new();
        let mut unignored_variants = Vec::new();
        if matches!(entry.content, EntryContent::Component { .. })
            && entry.metadata.variant_of.is_none()
        {
            for (slug, index) in self.children(side, entry, paths) {
                let signature = self.signature(side, index, paths)?;
                unignored_variants.push((slug.clone(), signature.unignored_hash));
                variants.push((slug, signature.hash));
                ignored.extend(signature.ignores);
            }
        }
        ignored.sort();
        ignored.dedup();
        Ok(MoveSignature {
            unignored_hash: digest(
                canonical::to_string(&(unignored, &steps, &extra, unignored_variants))
                    .compare()?
                    .as_bytes(),
            ),
            hash: digest(
                canonical::to_string(&(views, steps, extra, variants))
                    .compare()?
                    .as_bytes(),
            ),
            ignores: ignored,
        })
    }

    fn equal(&self, left: usize, right: usize, paths: &BTreeMap<String, String>) -> Result<bool> {
        let before = &self.before.catalogue().model.entries[left];
        let after = &self.after.catalogue().model.entries[right];
        let mut style_paths = paths.clone();
        if matches!(before.content, EntryContent::Component { .. })
            && matches!(after.content, EntryContent::Component { .. })
        {
            style_paths.insert(
                before
                    .metadata
                    .variant_of
                    .as_deref()
                    .unwrap_or(&before.metadata.path)
                    .to_ascii_lowercase(),
                after
                    .metadata
                    .variant_of
                    .as_ref()
                    .unwrap_or(&after.metadata.path)
                    .clone(),
            );
        }
        let left_plans = self.plans(ReviewSide::Before, left);
        let right_plans = self.plans(ReviewSide::After, right);
        if left_plans.keys().ne(right_plans.keys()) {
            return Ok(false);
        }
        for (key, left_plan) in left_plans {
            let right_plan = right_plans[&key];
            let left_artifact = self
                .before
                .comparison_document(&left_plan.route)
                .compare()?;
            let right_artifact = self
                .after
                .comparison_document(&right_plan.route)
                .compare()?;
            let (Some(left_document), Some(right_document)) =
                (&left_artifact.document, &right_artifact.document)
            else {
                return Ok(false);
            };
            let resources = closures(
                self.before.clone(),
                self.after.clone(),
                Some(&left_plan.route),
                Some(&right_plan.route),
                true,
                self.memo.as_ref(),
            )?;
            let mut comparison = view_material::compare(
                left_document,
                right_document,
                &format!("static/mokly-generated/{}", left_plan.route),
                &format!("static/mokly-generated/{}", right_plan.route),
                paths,
                &resources.aliases,
            );
            let owned = owned_styles::compare(
                [&left_document.tree, &right_document.tree],
                [
                    Some(&matching_tree::document(&left_document.tree, &style_paths)),
                    Some(&matching_tree::document(
                        &right_document.tree,
                        &BTreeMap::new(),
                    )),
                ],
                &style_paths,
                &format!("static/mokly-generated/{}", right_plan.route),
                self.memo.as_ref(),
            )?;
            let owner = matches!(after.content, EntryContent::Component { .. }).then_some(
                after
                    .metadata
                    .variant_of
                    .as_deref()
                    .unwrap_or(&after.metadata.path),
            );
            owned_styles::apply(&mut comparison, &owned);
            if comparison.changed || owned.changes_owner(owner) {
                return Ok(false);
            }
            for resource in resources
                .before
                .evidence
                .iter()
                .chain(&resources.after.evidence)
            {
                let after_path = resources
                    .aliases
                    .get(&resource.path)
                    .unwrap_or(&resource.path);
                let before_path = resources
                    .aliases
                    .iter()
                    .find_map(|(left, right)| (right == after_path).then_some(left))
                    .unwrap_or(after_path);
                let equal = self
                    .memo
                    .equal(before_path, after_path, &resources.aliases)?;
                if !equal {
                    return Ok(false);
                }
            }
        }
        if let (EntryContent::UseCase { steps: left }, EntryContent::UseCase { steps: right }) =
            (&before.content, &after.content)
        {
            let steps = |steps: &[mokly_model::catalogue::UseCaseStep],
                         paths: &BTreeMap<String, String>| {
                steps
                    .iter()
                    .map(|step| {
                        (
                            material::mapped(&step.screen_path, paths),
                            step.title.clone(),
                            step.description.clone(),
                        )
                    })
                    .collect::<Vec<_>>()
            };
            if steps(left, paths) != steps(right, &BTreeMap::new()) {
                return Ok(false);
            }
        }
        if let (
            EntryContent::Component {
                visual: left,
                slots: left_slots,
                ..
            },
            EntryContent::Component {
                visual: right,
                slots: right_slots,
                ..
            },
        ) = (&before.content, &after.content)
            && before.metadata.variant_of.is_none()
            && after.metadata.variant_of.is_none()
        {
            if canonical::to_string(&(&left.prop_schema, &left.controls, left_slots)).compare()?
                != canonical::to_string(&(&right.prop_schema, &right.controls, right_slots))
                    .compare()?
            {
                return Ok(false);
            }
            let before_children = self.children(ReviewSide::Before, before, paths);
            let after_children = self.children(ReviewSide::After, after, paths);
            if before_children.len() != after_children.len() {
                return Ok(false);
            }
            for (slug, left) in before_children {
                let Some(right) = after_children.get(&slug) else {
                    return Ok(false);
                };
                if !self.equal(left, *right, paths)? {
                    return Ok(false);
                }
            }
        }
        Ok(true)
    }

    fn lines(
        &self,
        before: usize,
        after: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<Option<MoveLines>> {
        self.author_lines(before, after, paths)
    }
}
