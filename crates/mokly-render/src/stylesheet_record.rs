//! A stylesheet record keeps the read evidence of its own inputs. The module evidence of its
//! PostCSS context is one shared entry with its own stamp.

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

/// The module evidence of one PostCSS context, shared by the records of that context.
pub(crate) struct ContextEvidence {
    /// Digest of the evidence. A bundle with equal module evidence may reuse the entry.
    pub(crate) digest: String,
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
    pub(crate) fn new(
        tree: &dyn SourceTree,
        root: &Path,
        digest: String,
        evidence: ReadEvidence,
    ) -> Self {
        let mut stamp = InputStamp::default();
        let consistent = stamp_evidence(tree, root, &evidence, &mut stamp);
        let bytes = size_of::<Self>()
            + digest.capacity()
            + evidence.retained_bytes()
            + stamp.retained_bytes();
        Self {
            digest,
            evidence,
            stamp,
            consistent,
            bytes,
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
                .is_none_or(|context| context.consistent)
    }

    /// The read evidence of the record's own inputs.
    pub(crate) fn evidence(&self) -> &ReadEvidence {
        &self.bundle.read_evidence
    }

    /// The bundle with its complete read evidence, as the inner bundler returned it.
    pub(crate) fn complete(&self) -> Bundle {
        let mut bundle = self.bundle.clone();
        if let Some(context) = &self.context {
            bundle.read_evidence.extend(context.evidence.clone());
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
