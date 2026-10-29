//! A stylesheet record keeps the read evidence of its own inputs. Module evidence grows through
//! a chain of shared context entries, and each entry stores only its added versions.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;

use mokly_css::types::Bundle;
use mokly_model::material::digest;
use mokly_source_interface::range_evidence;
use mokly_source_interface::read_evidence::ReadEvidence;
use mokly_source_interface::tree::SourceTree;

use crate::input_stamp::InputStamp;
use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_weight;

/// The added module evidence of one PostCSS context.
pub(crate) struct ContextEvidence {
    /// Digest of the full evidence. A bundle with equal module evidence may reuse the entry.
    pub(crate) digest: String,
    /// The entry whose full evidence this entry extends.
    pub(crate) base: Option<Arc<ContextEvidence>>,
    /// Module paths and versions that the base entry does not contain.
    pub(crate) evidence: ReadEvidence,
    pub(crate) stamp: InputStamp,
    consistent: bool,
    pub(crate) bytes: usize,
}

/// One stylesheet root's bundle with the stamp of its own inputs.
pub(crate) struct Record {
    pub(crate) stamp: InputStamp,
    /// The bundle without the module evidence of its context.
    bundle: Bundle,
    pub(crate) context: Option<Arc<ContextEvidence>>,
    consistent: bool,
    pub(crate) bytes: usize,
}

impl ContextEvidence {
    pub(crate) fn with_base(
        tree: &dyn SourceTree,
        root: &Path,
        digest: String,
        full_evidence: ReadEvidence,
        base: Option<Arc<ContextEvidence>>,
    ) -> Self {
        let evidence = delta_evidence(base.as_ref(), full_evidence);
        let mut stamp = InputStamp::default();
        let consistent = stamp_delta_evidence(tree, root, base.as_ref(), &evidence, &mut stamp);
        let bytes = size_of::<Self>()
            + digest.capacity()
            + evidence.retained_bytes()
            + stamp.retained_bytes();
        Self {
            digest,
            base,
            evidence,
            stamp,
            consistent,
            bytes,
        }
    }

    /// Visit this entry and each base without recursive calls.
    pub(crate) fn entries(&self) -> impl Iterator<Item = &Self> {
        std::iter::successors(Some(self), |entry| entry.base.as_deref())
    }

    /// The number of versions in the complete evidence.
    pub(crate) fn full_size(&self) -> usize {
        self.entries()
            .flat_map(|entry| entry.evidence.inputs.values())
            .map(BTreeSet::len)
            .sum()
    }

    /// Whether every version of this chain occurs in the supplied full evidence.
    pub(crate) fn is_subset_of(&self, full: &ReadEvidence) -> bool {
        self.entries().all(|entry| {
            entry.evidence.inputs.iter().all(|(path, versions)| {
                full.inputs
                    .get(path)
                    .is_some_and(|available| versions.is_subset(available))
            })
        })
    }

    /// Whether the full evidence of this chain agrees.
    pub(crate) fn chain_consistent(&self) -> bool {
        self.entries().all(|entry| entry.consistent)
    }

    /// Retained entries in base-first order for validation, delivery, and charging.
    pub(crate) fn chain_arcs(context: &Arc<ContextEvidence>) -> Vec<Arc<ContextEvidence>> {
        let mut entries = Vec::new();
        let mut next = Some(context);
        while let Some(entry) = next {
            entries.push(entry.clone());
            next = entry.base.as_ref();
        }
        entries.reverse();
        entries
    }

    /// Restore exactly the module evidence represented by this chain.
    pub(crate) fn append_full_evidence(&self, target: &mut ReadEvidence) {
        for entry in self.entries() {
            target.extend(entry.evidence.clone());
        }
    }
}

impl Record {
    /// Stamp a new bundle. `context` returns the entry for the bundle's module evidence and its
    /// digest.
    pub(crate) fn new(
        tree: &dyn SourceTree,
        root: &Path,
        mut bundle: Bundle,
        context: impl FnOnce(String, ReadEvidence) -> Arc<ContextEvidence>,
    ) -> Self {
        let modules = module_evidence(&mut bundle.read_evidence);
        let context = (!modules.inputs.is_empty())
            .then(|| context(digest(format!("{:?}", modules.inputs).as_bytes()), modules));
        let mut stamp = InputStamp::default();
        for path in bundle.inputs.keys().chain(bundle.dependency_digests.keys()) {
            stamp.file(tree, root.join(path));
        }
        for asset in bundle.assets.values() {
            for path in asset.input_paths() {
                stamp.asset(tree, root.join(path));
            }
        }
        stamp.directories(tree, root, &bundle.directories);
        let consistent = stamp_evidence(tree, root, &bundle.read_evidence, &mut stamp);
        let bytes = size_of::<Self>() + stylesheet_weight::bundle(&bundle) + stamp.retained_bytes();
        Self {
            stamp,
            bundle,
            context,
            consistent,
            bytes,
        }
    }

    /// Only a record whose own and context evidence agree may enter the shared store.
    pub(crate) fn shareable(&self) -> bool {
        self.consistent
            && self
                .context
                .as_ref()
                .is_none_or(|context| context.chain_consistent())
    }

    /// The read evidence of the record's own inputs.
    pub(crate) fn evidence(&self) -> &ReadEvidence {
        &self.bundle.read_evidence
    }

    /// The bundle with its complete read evidence, as the inner bundler returned it.
    pub(crate) fn complete(&self) -> Bundle {
        let mut bundle = self.bundle.clone();
        if let Some(context) = &self.context {
            context.append_full_evidence(&mut bundle.read_evidence);
        }
        bundle
    }
}

/// Move the module evidence out of a bundle's evidence. Its own inputs carry the source prefix.
fn module_evidence(evidence: &mut ReadEvidence) -> ReadEvidence {
    let (own, modules) = std::mem::take(&mut evidence.inputs)
        .into_iter()
        .partition(|(path, _)| path.starts_with(SOURCE_INPUT_PREFIX));
    evidence.inputs = own;
    ReadEvidence {
        coverage: evidence.coverage.clone(),
        inputs: modules,
    }
}

/// Stamp every whole-file version and file identity, and report whether the versions agree.
fn stamp_evidence(
    tree: &dyn SourceTree,
    root: &Path,
    evidence: &ReadEvidence,
    stamp: &mut InputStamp,
) -> bool {
    let mut consistent = true;
    for (path, versions) in &evidence.inputs {
        let absolute = root.join(path);
        if versions.iter().any(|version| version.identity().is_some()) {
            stamp.identity(tree, absolute.clone());
            let current = stamp.identities.get(&absolute).and_then(Option::as_ref);
            consistent &= versions
                .iter()
                .filter_map(|version| version.identity())
                .all(|identity| current.is_some_and(|(_, object)| *object == identity.object));
        }
        let mut digests = versions.iter().filter_map(|version| version.whole_digest());
        if let Some(first) = digests.next() {
            consistent &= digests.all(|other| other == first);
            consistent &= range_evidence::verify(tree, &absolute, versions, first);
            stamp.files.insert(absolute, Some(first.into()));
        }
    }
    consistent
}

fn delta_evidence(base: Option<&Arc<ContextEvidence>>, mut full: ReadEvidence) -> ReadEvidence {
    if let Some(base) = base {
        for entry in base.entries() {
            for (path, versions) in &entry.evidence.inputs {
                if let Some(added) = full.inputs.get_mut(path) {
                    added.retain(|version| !versions.contains(version));
                    if added.is_empty() {
                        full.inputs.remove(path);
                    }
                }
            }
        }
    }
    full
}

fn stamp_delta_evidence(
    tree: &dyn SourceTree,
    root: &Path,
    base: Option<&Arc<ContextEvidence>>,
    delta: &ReadEvidence,
    stamp: &mut InputStamp,
) -> bool {
    let Some(base) = base else {
        return stamp_evidence(tree, root, delta, stamp);
    };
    let mut full_paths = delta.clone();
    for (path, versions) in &mut full_paths.inputs {
        for entry in base.entries() {
            if let Some(earlier) = entry.evidence.inputs.get(path) {
                versions.extend(earlier.iter().cloned());
            }
        }
    }
    stamp_evidence(tree, root, &full_paths, stamp)
}
