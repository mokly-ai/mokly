//! Complete head validation can borrow optional view facts from its caller.

use std::collections::BTreeSet;
use std::fmt;
use std::result;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_html::composition::Composed;

use crate::cache::Artifact;
use crate::closure::ClosureBuilder;
use crate::comparison_proof::{ContentIdentity, content_identity};
use crate::error::Result;
use crate::head_walks::WalkRecord;
use crate::policy::PublicFile;
use crate::public_denial::PublicDenial;
use crate::workers::ValidatedView;

/// Inputs observed at the closure walk's read boundaries and by the link checks.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ValidationRead {
    /// Public policy and the generation's declared route inventories.
    Policy,
    /// Current checked document by its document key and the comparison policy.
    Document,
    /// Eligibility of one lexical authored resource target.
    PublicTarget,
    /// Content of an authored target, including ignored targets.
    StaticContent,
    /// Document and resource membership, including absent routes.
    GeneratedMembership,
    /// Content of a generated resource followed by the walk.
    GeneratedContent,
    /// Destination, views, and document keys that one logical link target reaches.
    LinkTarget,
}

/// A walk-local recorder. Unknown inputs prevent optional fact retention.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ValidationRecorderMock))]
pub trait ValidationRecorder: Send + Sync {
    /// Record an input even when it is ignored, unavailable, or absent.
    fn input(&self, kind: ValidationRead, route: &str);
    /// Record the actual read's identity without reading its source again.
    fn content(&self, kind: ValidationRead, route: &str, identity: Option<ContentIdentity>);
    /// Record each lexical observer call, in walk order.
    fn observe(&self, path: &str);
    /// Decline proof when a builder cannot record all of its inputs.
    fn unknown(&self);
}

/// Closure-derived metadata; it keeps no document, usage, or resource payload.
#[derive(Clone, Debug, Default)]
pub struct ClosureFacts {
    /// Authored files accepted by the closure walk.
    pub files: BTreeSet<String>,
    /// Closure warnings in walk order, with duplicates intact.
    pub warnings: Vec<Warning>,
    /// Observer calls to replay only when these facts replace a walk.
    pub replay: Vec<String>,
}

/// Exact checks that the generation wrappers applied to one checked head document read.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct DocumentChecks {
    /// Digest of the checked document bytes, when a checking wrapper keeps one.
    pub digest: Option<String>,
}

/// The result of proving one view before its document is read.
#[derive(Debug)]
pub enum HeadProof {
    /// Every kept input and check is proven, so the view needs no document read.
    Kept(ValidatedView),
    /// The view needs its current checked document.
    Read(ClosureProof),
}

/// What the proof before the document read leaves for the closure step.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ClosureProof {
    /// No closure replay ran, so the closure step may replay kept facts.
    #[default]
    Unknown,
    /// A replay found a changed closure input, so the closure step walks.
    Changed,
}

/// Attempt-owned reads and optional facts used before global validation finishes.
pub trait HeadValidation: Send + Sync {
    /// Prove a view from kept facts and adopt its checks before any document read.
    fn kept(&self, _route: &str, _builder: &dyn ClosureBuilder) -> HeadProof {
        HeadProof::Read(ClosureProof::Unknown)
    }
    /// Read the current document through all generation wrapper checks.
    fn document(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Prove a kept closure, replay this generation's background walk, or walk.
    fn closure(
        &self,
        route: &str,
        document: &Composed,
        builder: &dyn ClosureBuilder,
        proof: ClosureProof,
        pass: Option<WalkRecord>,
    ) -> Result<ClosureFacts>;
    /// Keep the outputs of a view validated from its current document.
    fn validated(&self, _route: &str, _document: &Composed, _view: &ValidatedView) {}
}

impl fmt::Debug for dyn HeadValidation + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("HeadValidation")
    }
}

pub(crate) struct Unrecorded;

impl ValidationRecorder for Unrecorded {
    fn input(&self, _kind: ValidationRead, _route: &str) {}
    fn content(&self, _kind: ValidationRead, _route: &str, _identity: Option<ContentIdentity>) {}
    fn observe(&self, _path: &str) {}
    fn unknown(&self) {}
}

/// Identify exact resource content, or proved absence, from an existing digest.
pub fn resource_identity(digest: Option<&str>) -> Option<ContentIdentity> {
    Some(content_identity(&serde_json::to_vec(&digest).ok()?))
}

pub(crate) fn public_identity(
    decision: &result::Result<PublicFile, PublicDenial>,
) -> Option<ContentIdentity> {
    let value = match decision {
        Ok(file) => serde_json::to_vec(&(true, &file.path, &file.absolute)).ok()?,
        Err(reason) => serde_json::to_vec(&(false, format!("{reason:?}"))).ok()?,
    };
    Some(content_identity(&value))
}

impl fmt::Debug for dyn ValidationRecorder + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ValidationRecorder")
    }
}
