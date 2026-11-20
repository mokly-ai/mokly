//! The answer a completion takes from the upload's own persisted state.
//!
//! The fast check before blobs are examined and the ready transaction both
//! decide here, so a completion repeated while the first one is still running
//! reaches the same answer as the first and never treats its own upload as a
//! different, replacing one.

use chrono::{DateTime, Utc};
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_store_interface::publication::{Publication, PublicationFailure, PublicationState};
use mkc_store_interface::store::Queries;

use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{Ingested, UploadAuthorization};

/// What a completion does for one upload.
#[derive(Debug)]
pub(crate) enum Outcome {
    /// The upload itself is the ready (or since expired) publication: every
    /// completion answers 201 with this row and changes nothing.
    Published(Publication),
    /// The upload was already closed because this different publication is
    /// ready for its identity: answer 200 with it and change nothing.
    Replaced(Publication),
    /// The upload is unfinished and this different publication is ready for
    /// its identity: close the upload as superseded and answer 200 with it.
    Supersede(Publication),
    /// The upload is unfinished, before its deadline, and nothing is ready for
    /// its identity: publish it.
    Publish,
}

/// The mandatory index the plan stored, as completion read it before the
/// ready transaction.
#[derive(Debug)]
pub(crate) enum StoredIndex {
    /// The stored index, decoded.
    Loaded(Box<CatalogueIndex>),
    /// The index's file reference or stored bytes were gone. Closing an
    /// upload releases its references, so only the ready transaction decides
    /// whether this fails the completion: it does when the upload is still to
    /// be published.
    Missing,
}

impl StoredIndex {
    /// The decoded index, when completion loaded one.
    pub(crate) fn index(&self) -> Option<&CatalogueIndex> {
        match self {
            Self::Loaded(index) => Some(index.as_ref()),
            Self::Missing => None,
        }
    }
}

/// Whether the decision needs the publication currently ready for the upload's
/// identity (project, head SHA and config path).
pub(crate) fn needs_ready_publication(upload: &Publication) -> bool {
    match upload.state {
        PublicationState::Validating => true,
        PublicationState::Failed => upload.failure == Some(PublicationFailure::Superseded),
        PublicationState::Uploading | PublicationState::Ready | PublicationState::Expired => false,
    }
}

/// Decide from the upload's row and the publication ready for its identity.
///
/// A ready publication with the upload's own id is the upload itself, so it
/// answers as published and can never close the upload or release its files.
pub(crate) fn decide(
    upload: &Publication,
    ready: Option<Publication>,
    now: DateTime<Utc>,
) -> Result<Outcome> {
    match (upload.state, ready) {
        (PublicationState::Ready | PublicationState::Expired, _) => {
            Ok(Outcome::Published(upload.clone()))
        }
        (_, Some(itself)) if itself.id == upload.id => Ok(Outcome::Published(itself)),
        (PublicationState::Validating, Some(ready)) => Ok(Outcome::Supersede(ready)),
        (PublicationState::Failed, Some(ready))
            if upload.failure == Some(PublicationFailure::Superseded) =>
        {
            Ok(Outcome::Replaced(ready))
        }
        (PublicationState::Validating, None) if upload.deadline > now => Ok(Outcome::Publish),
        _ => Err(Error::Expired),
    }
}

/// Read what the decision needs inside the caller's transaction, then decide.
pub(crate) fn resolve(
    queries: &mut dyn Queries,
    upload: &Publication,
    now: DateTime<Utc>,
) -> Result<Outcome> {
    let ready = match &upload.metadata {
        Some(metadata) if needs_ready_publication(upload) => queries
            .publication_by_identity(upload.project_id, &metadata.head_sha, &metadata.config_path)
            .context("read the publication ready for the upload identity")?,
        _ => None,
    };
    decide(upload, ready, now)
}

/// The receipt for a completion: the publication, the current slugs and whether
/// a different upload published the identity.
pub(crate) fn ingested(
    authorization: &UploadAuthorization,
    publication: Publication,
    replay: bool,
) -> Ingested {
    Ingested {
        publication,
        organization_slug: authorization.organization_slug.clone(),
        project_slug: authorization.project_slug.clone(),
        replay,
    }
}
