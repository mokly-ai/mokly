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
        let evidence = delta_evidence(base.as_ref(), &full_evidence);
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

    pub(crate) fn full_evidence(&self) -> ReadEvidence {
        let mut full = self
            .base
            .as_ref()
            .map_or_else(ReadEvidence::default, |base| base.full_evidence());
        full.extend(self.evidence.clone());
        full
    }

    pub(crate) fn full_size(&self) -> usize {
        self.base.as_ref().map_or(0, |base| base.full_size())
            + self
                .evidence
                .inputs
                .values()
                .map(BTreeSet::len)
                .sum::<usize>()
    }

    pub(crate) fn is_subset_of(&self, full: &ReadEvidence) -> bool {
        self.full_evidence().inputs.iter().all(|(path, versions)| {
            full.inputs
                .get(path)
                .is_some_and(|available| versions.is_subset(available))
        })
    }

    pub(crate) fn chain_consistent(&self) -> bool {
        self.consistent
            && self
                .base
                .as_ref()
                .is_none_or(|base| base.chain_consistent())
    }

    pub(crate) fn for_each_chain(&self, callback: &mut impl FnMut(&ContextEvidence)) {
        if let Some(base) = &self.base {
            base.for_each_chain(callback);
        }
        callback(self);
    }

    pub(crate) fn chain_arcs(context: &Arc<ContextEvidence>) -> Vec<Arc<ContextEvidence>> {
        let mut entries = context
            .base
            .as_ref()
            .map_or_else(Vec::new, Self::chain_arcs);
        entries.push(context.clone());
        entries
    }

    pub(crate) fn append_full_evidence(&self, target: &mut ReadEvidence) {
        if let Some(base) = &self.base {
            base.append_full_evidence(target);
        }
        target.extend(self.evidence.clone());
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

fn delta_evidence(base: Option<&Arc<ContextEvidence>>, full: &ReadEvidence) -> ReadEvidence {
    let Some(base) = base else {
        return full.clone();
    };
    let base = base.full_evidence();
    let mut delta = full.clone();
    for (path, versions) in base.inputs {
        if let Some(added) = delta.inputs.get_mut(&path) {
            added.retain(|version| !versions.contains(version));
            if added.is_empty() {
                delta.inputs.remove(&path);
            }
        }
    }
    delta
}

fn stamp_delta_evidence(
    tree: &dyn SourceTree,
    root: &Path,
    base: Option<&Arc<ContextEvidence>>,
    delta: &ReadEvidence,
    stamp: &mut InputStamp,
) -> bool {
    let base = base.map(|base| base.full_evidence());
    let mut consistent = true;
    for (path, added) in &delta.inputs {
        let mut versions = base
            .as_ref()
            .and_then(|base| base.inputs.get(path).cloned())
            .unwrap_or_default();
        versions.extend(added.iter().cloned());
        let mut evidence = ReadEvidence::default();
        evidence.inputs.insert(path.clone(), versions);
        consistent &= stamp_evidence(tree, root, &evidence, stamp);
    }
    consistent
}
