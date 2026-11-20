//! Workers release decoded documents before their ordered capture hand-off.

use std::fmt;
use std::mem;

use crate::closure::Closure;
use crate::collection_charge;
use crate::comparison_proof::ContentIdentity;
use crate::document_codec::EncodedView;
use crate::error::{GraphError, InternalError, Result};
use crate::types::ComparisonDocument;

/// Encoding boundary supplied by a collector, including any checking wrapper.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonEncoderMock))]
pub trait ComparisonEncoder: Send + Sync {
    /// Encode and identify the checked input without retaining its decoded artifact.
    fn encode(
        &self,
        route: &str,
        input: &ComparisonDocument,
    ) -> Result<(EncodedView, ContentIdentity)>;
}

/// The normal lossless encoder, used by collectors without extra checks.
pub struct DocumentEncoder;

impl ComparisonEncoder for DocumentEncoder {
    fn encode(
        &self,
        _route: &str,
        input: &ComparisonDocument,
    ) -> Result<(EncodedView, ContentIdentity)> {
        match EncodedView::encode_identified(&input.artifact) {
            Ok(document) => Ok(document),
            Err(source) => Err(GraphError::Internal(InternalError::Provider {
                source: Box::new(source),
            })),
        }
    }
}

/// One encoded view waiting for its route's capture turn.
pub struct EncodedComparisonDocument {
    /// Exact compressed document bytes, tree, and composition metadata.
    pub document: EncodedView,
    /// Exact codec input identity for retained equal-document admission.
    pub identity: ContentIdentity,
    /// Validated authored resources and comparison evidence.
    pub closure: Closure,
}

impl EncodedComparisonDocument {
    /// Encode and release one transient decoded input on its current worker.
    pub fn encode(
        route: &str,
        input: ComparisonDocument,
        encoder: &dyn ComparisonEncoder,
    ) -> Result<Self> {
        let (document, identity) = encoder.encode(route, &input)?;
        Ok(Self {
            document,
            identity,
            closure: input.closure,
        })
    }

    /// Charge the queued input beside already retained views in the same bound.
    pub fn retained_bytes(&self, route: &str) -> usize {
        256 + route.len()
            + self.document.retained_bytes()
            + mem::size_of::<ContentIdentity>()
            + collection_charge::closure(&self.closure)
    }
}

impl fmt::Debug for EncodedComparisonDocument {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("EncodedComparisonDocument")
            .field("encoded_bytes", &self.document.bytes())
            .field("closure", &self.closure)
            .finish()
    }
}
