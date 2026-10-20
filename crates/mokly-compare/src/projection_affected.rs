//! Index affected consumers and preserve first-seen ordering with one key per link.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::canonical;
use mokly_model::public_detail::{RelatedComponent, UsageLink, VisualKind};
use mokly_model::review_affected::{ConsumerKind, ReviewSide};

use crate::comparison_error::CompareResult;
use crate::comparison_types::ComparisonResult;
use crate::error::Result;
use crate::projection_context::Context;
use crate::projection_reference::References;

#[derive(Default)]
pub(crate) struct Affected {
    pub(crate) consumers: BTreeSet<String>,
    pub(crate) related: BTreeMap<String, Vec<RelatedComponent>>,
    pub(crate) links: BTreeMap<String, Vec<UsageLink>>,
}

pub(crate) fn index(result: &ComparisonResult, context: &Context<'_>) -> Result<Affected> {
    let mut output = Affected::default();
    let references = References::new(result)?;
    let mut related_seen = BTreeSet::new();
    let mut links_seen = BTreeSet::new();
    for effect in &result.review.affected {
        let consumer = &effect.consumer.path;
        output.consumers.insert(consumer.clone());
        if related_seen.insert((consumer.as_str(), effect.changed_component_id.as_str())) {
            output
                .related
                .entry(consumer.clone())
                .or_default()
                .push(RelatedComponent {
                    path: effect.changed_component_id.clone(),
                    title: context
                        .metadata
                        .get(effect.changed_component_id.as_str())
                        .map_or(effect.changed_component_id.as_str(), |metadata| {
                            metadata.title.as_str()
                        })
                        .into(),
                });
        }
        let mut projected = Vec::new();
        for evidence in &effect.evidence {
            if let Some(target) = references.affected(effect, evidence)? {
                projected.push((evidence, target));
            }
        }
        let after: BTreeSet<_> = projected
            .iter()
            .filter(|(evidence, _)| evidence.side == ReviewSide::After)
            .map(|(evidence, target)| {
                (
                    target.metadata.path.as_str(),
                    evidence.context.viewport,
                    evidence.context.color_scheme,
                    evidence
                        .via
                        .last()
                        .map(|instance| instance.instance_key.as_str()),
                )
            })
            .collect();
        for (evidence, target) in &projected {
            if evidence.side == ReviewSide::Before
                && after.contains(&(
                    target.metadata.path.as_str(),
                    evidence.context.viewport,
                    evidence.context.color_scheme,
                    evidence
                        .via
                        .last()
                        .map(|instance| instance.instance_key.as_str()),
                ))
            {
                continue;
            }
            let Some(instance) = evidence.via.last() else {
                continue;
            };
            let kind = match effect.consumer.kind {
                ConsumerKind::Screen => EntryKind::Screen,
                ConsumerKind::Component => EntryKind::Component,
            };
            let link = UsageLink {
                entry_path: target.metadata.path.clone(),
                entry_kind: match kind {
                    EntryKind::Screen => VisualKind::Screen,
                    _ => VisualKind::Component,
                },
                title: target.metadata.title.clone(),
                viewport: evidence.context.viewport,
                color_scheme: evidence.context.color_scheme,
                instance_key: instance.instance_key.clone(),
                direct: evidence.via.len() == 1,
                removed: target.removed,
                comparison_eligible: context.can_compare(&target.metadata.path, kind),
            };
            let key = canonical::to_string(&link).compare()?;
            if links_seen.insert((effect.changed_component_id.as_str(), key)) {
                output
                    .links
                    .entry(effect.changed_component_id.clone())
                    .or_default()
                    .push(link);
            }
        }
    }
    Ok(output)
}
