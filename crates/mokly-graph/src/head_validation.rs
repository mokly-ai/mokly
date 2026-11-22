//! Complete head validation can borrow optional closure facts from its caller.

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
use crate::policy::PublicFile;
use crate::public_denial::PublicDenial;

/// Inputs observed at the closure walk's read boundaries.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ValidationRead {
    /// Public policy and the generation's declared route inventories.
    Policy,
    /// Current checked document, including its complete render recipe.
    Document,
    /// Eligibility of one lexical authored resource target.
    PublicTarget,
    /// Content of an authored target, including ignored targets.
    StaticContent,
    /// Document and resource membership, including absent routes.
    GeneratedMembership,
    /// Content of a generated resource followed by the walk.
    GeneratedContent,
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

/// Attempt-owned reads and optional facts used before global validation finishes.
pub trait HeadValidation: Send + Sync {
    /// Read the current document through all generation wrapper checks.
    fn document(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Prove a kept closure or run this view's complete ordinary walk.
    fn closure(
        &self,
        route: &str,
        document: &Composed,
        builder: &dyn ClosureBuilder,
    ) -> Result<ClosureFacts>;
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
