//! Shared comparison evidence for current and historical details.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::evidence::ViewEvidence;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::review::{EntryChangeReason, ReviewEntry, ReviewEntryAddress, ReviewKind};
use mokly_model::review_order;

use crate::comparison_types::{ComparisonResult, DocumentComparison, EntryClassification};

/// Copy included reasons, view states, ignore ids, evidence, and a current entry's base address.
pub fn apply_evidence(details: &mut BTreeMap<String, EntryDetailV4>, result: &ComparisonResult) {
    let evidence = Evidence::new(result);
    for (path, detail) in details {
        evidence.entry(path, detail).apply(detail);
    }
}

/// The classified entries and base sides of one result, indexed once for each detail.
pub struct Evidence<'a> {
    entries: BTreeMap<&'a str, Vec<&'a EntryClassification>>,
    bases: BTreeMap<(EntryKind, &'a str), &'a ReviewEntryAddress>,
}

impl<'a> Evidence<'a> {
    /// Index the entries of `result` by path, in result order, and its base addresses.
    pub fn new(result: &'a ComparisonResult) -> Self {
        let mut entries: BTreeMap<&str, Vec<&EntryClassification>> = BTreeMap::new();
        for entry in &result.entries {
            entries.entry(entry.path.as_str()).or_default().push(entry);
        }
        Self {
            entries,
            bases: base_addresses(&result.review.entries),
        }
    }

    /// Borrow the evidence that `apply_evidence` writes into the detail at `path`.
    /// The detail supplies only its kind, its revision presence, and its view axes.
    pub fn entry(&self, path: &str, detail: &EntryDetailV4) -> EntryEvidence<'a> {
        let mut evidence = EntryEvidence {
            views: vec![None; detail.views.len()],
            ..EntryEvidence::default()
        };
        let entries = self.entries.get(path).into_iter().flatten().copied();
        for entry in entries.filter(|entry| entry.kind == detail.entry.kind) {
            evidence.reasons = Some(entry.included.then(|| {
                let mut reasons = entry.reasons.clone();
                review_order::normalize_reasons(&mut reasons);
                reasons
            }));
            if detail.revision.is_some() {
                evidence.before = Some(self.bases.get(&(entry.kind, entry.path.as_str())).copied());
            }
            for document in &entry.documents {
                if let Some(index) = detail.views.iter().position(|view| {
                    Some(view.viewport) == document.key.viewport
                        && view.color_scheme == document.key.color_scheme
                }) {
                    evidence.views[index] = Some(document);
                }
                if entry.kind == EntryKind::Page {
                    evidence.page = Some(&document.evidence);
                }
            }
        }
        evidence
    }
}

/// The evidence fields of one detail, borrowed from a result until they are written.
/// An absent field leaves the detail's own value.
#[derive(Default)]
pub struct EntryEvidence<'a> {
    reasons: Option<Option<Vec<EntryChangeReason>>>,
    before: Option<Option<&'a ReviewEntryAddress>>,
    views: Vec<Option<&'a DocumentComparison>>,
    page: Option<&'a ViewEvidence>,
}

impl EntryEvidence<'_> {
    /// Write this evidence into the detail that it was borrowed for.
    pub fn apply(self, detail: &mut EntryDetailV4) {
        if let Some(reasons) = self.reasons {
            detail.reasons = reasons;
        }
        if let Some(before) = self.before {
            detail.before = before.cloned();
        }
        for (view, document) in detail.views.iter_mut().zip(self.views) {
            if let Some(document) = document {
                view.state = Some(document.state);
                view.ignored_ids = Some(document.ignored_ids.clone());
                view.resource_evidence = Some(document.evidence.clone());
            }
        }
        if let Some(evidence) = self.page {
            detail.resource_evidence = Some(evidence.clone());
        }
    }

    /// Whether `detail` holds exactly the evidence fields that `apply` gives a detail with none.
    pub fn matches(&self, detail: &EntryDetailV4) -> bool {
        detail.reasons.as_ref() == self.reasons.as_ref().and_then(Option::as_ref)
            && detail.before.as_ref() == self.before.flatten()
            && detail.resource_evidence.as_ref() == self.page
            && detail.views.iter().enumerate().all(|(index, view)| {
                let document = self.views.get(index).copied().flatten();
                view.state == document.map(|document| document.state)
                    && view.ignored_ids.as_ref() == document.map(|document| &document.ignored_ids)
                    && view.resource_evidence.as_ref()
                        == document.map(|document| &document.evidence)
            })
    }
}

/// Base sides of current screens, components, and variants, keyed by kind and current path.
fn base_addresses(entries: &[ReviewEntry]) -> BTreeMap<(EntryKind, &str), &ReviewEntryAddress> {
    entries
        .iter()
        .flat_map(|entry| std::iter::once(entry).chain(entry.variants.iter().flatten()))
        .filter(|entry| entry.after.is_some())
        .filter_map(|entry| {
            let kind = match entry.kind {
                ReviewKind::Screen => EntryKind::Screen,
                ReviewKind::Component => EntryKind::Component,
                ReviewKind::UseCase => return None,
            };
            entry
                .before
                .as_ref()
                .map(|before| ((kind, entry.path.as_str()), before))
        })
        .collect()
}
