//! Atomic ready transition, decided from the upload's own row.

use mkc_domain::ids::ProjectId;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationMetadata, PublicationState,
};
use mkc_store_interface::publication_changes::{Changes, Counts};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::publication_screens::ScreenView;
use mkc_store_interface::store::Queries;

use crate::completion_outcome::{self, Outcome, StoredIndex};
use crate::error::{DurabilityFailure, Error, ErrorResultExt, Result};
use crate::ingest::{Ingested, PublicationIngest, UploadAuthorization};
use crate::lifecycle::close_unfinished;
use crate::locations::branch_alias;
use crate::screen_observation;
use crate::upload_authorization::{Credential, UploadCommit, UploadPolicy};

use super::Completion;

impl Completion for PublicationIngest {
    /// Publish the upload unless its own row, reread in the same transaction,
    /// shows that another request already answered or closed it.
    ///
    /// Only this decision turns a missing stored index into a failure: an
    /// upload closed meanwhile gets the answer for its closed state.
    fn finish(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        metadata: &PublicationMetadata,
        index: &StoredIndex,
    ) -> Result<Ingested> {
        let counts = index.index().and_then(|index| index.changes_count());
        let changes = counts.map_or(Changes::NoComparison, |counts| {
            Changes::Available(Counts {
                changed: counts.changed,
                added: counts.added,
                removed: counts.removed,
            })
        });
        let screen_views = index
            .index()
            .filter(|_| counts.is_some())
            .map(|index| screen_observation::views(index.current_screens()))
            .unwrap_or_default();
        let now = self.runtime.now();
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: attempt.id,
            kind: EventKind::Ready,
            created_at: now,
        };
        let failed = PublicationEvent {
            id: self.runtime.id(),
            kind: EventKind::Failed,
            ..event.clone()
        };
        let mut result = None;
        self.transactions.run(false, &mut |queries| {
            result = None;
            if let Credential::Build(digest) = &authorization.credential
                && !queries
                    .lock_build_grant(digest)
                    .context("lock completing build before publication writes")?
            {
                return Err(Error::Unauthorized);
            }
            let now = self.runtime.now();
            let mut authorized = self.check(queries, authorization, Some(attempt.id), now)?;
            let upload = queries
                .publication(attempt.id)
                .context("reread the completing upload")?
                .ok_or(Error::Expired)?;
            authorized.scope(&upload)?;
            let outcome = completion_outcome::resolve(queries, &upload, now)?;
            let changes_state = matches!(outcome, Outcome::Supersede(_) | Outcome::Publish);
            let answer = match outcome {
                Outcome::Published(publication) => {
                    completion_outcome::ingested(authorization, publication, false)
                }
                Outcome::Replaced(ready) => {
                    completion_outcome::ingested(authorization, ready, true)
                }
                Outcome::Supersede(ready) => {
                    close_unfinished(queries, attempt.id, PublicationFailure::Superseded, &failed)?;
                    completion_outcome::ingested(authorization, ready, true)
                }
                Outcome::Publish => {
                    if let StoredIndex::Missing = index {
                        return Err(Error::internal(DurabilityFailure::StoredIndexMissing {
                            publication: attempt.id,
                        }));
                    }
                    finish_ready(
                        queries,
                        attempt,
                        metadata,
                        changes,
                        &screen_views,
                        &event,
                        authorized.project.id,
                    )?;
                    ready_result(attempt, authorization, metadata, changes)
                }
            };
            authorized.consume(queries, answer.publication.id, &|| self.runtime.now())?;
            if changes_state {
                authorized.touch_token(queries, now)?;
            }
            result = Some(answer);
            Ok(())
        })?;
        result.ok_or(Error::Expired)
    }
}

fn finish_ready(
    queries: &mut dyn Queries,
    attempt: &Publication,
    metadata: &PublicationMetadata,
    changes: Changes,
    screen_views: &[ScreenView],
    event: &PublicationEvent,
    project: ProjectId,
) -> Result<()> {
    let pending = queries
        .pending_publication_blobs(attempt.id)
        .context("verify publication blob durability")?;
    if !pending.is_empty() {
        return Err(Error::internal(
            DurabilityFailure::PendingPublicationBlobs {
                publication: attempt.id,
                count: pending.len(),
            },
        ));
    }
    queries
        .insert_publication_screen_views(attempt.id, screen_views)
        .context("persist accepted sharing selections")?;
    if !queries
        .ready_publication(attempt.id, changes)
        .context("atomically publish complete catalogue")?
    {
        return Err(Error::Expired);
    }
    queries
        .insert_branch_alias(
            &branch_alias(project, &metadata.branch),
            project,
            &metadata.branch,
        )
        .context("register ready branch alias")?;
    queries
        .insert_publication_event(event)
        .context("enqueue publication check")
}

fn ready_result(
    attempt: &Publication,
    authorization: &UploadAuthorization,
    metadata: &PublicationMetadata,
    changes: Changes,
) -> Ingested {
    Ingested {
        publication: Publication {
            metadata: Some(metadata.clone()),
            state: PublicationState::Ready,
            changes: Some(changes),
            ..attempt.clone()
        },
        organization_slug: authorization.organization_slug.clone(),
        project_slug: authorization.project_slug.clone(),
        replay: false,
    }
}
