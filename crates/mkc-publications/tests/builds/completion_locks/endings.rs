//! Query-only build endings, with the same fences and cleanup as the worker.

use chrono::{DateTime, Duration, Utc};
use mkc_publications::error::{ErrorResultExt, Result};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::publication::PublicationFailure;
use mkc_store_interface::store::Queries;
use uuid::Uuid;

#[derive(Clone, Copy, Debug)]
pub(super) enum Ending {
    Cancel,
    Supersede,
    Finalize,
    Requeue,
    Recover,
}

impl Ending {
    pub(super) fn run(
        self,
        q: &mut dyn Queries,
        build: &NewBuild,
        at: DateTime<Utc>,
    ) -> Result<bool> {
        match self {
            Self::Cancel => {
                q.cancel_build(build.project_id, build.id, at)
                    .context("cancel overlapping completion")?;
            }
            Self::Supersede => {
                q.schedule_build(&NewBuild {
                    id: Uuid::from_u128(build.id.0.as_u128() + 1).into(),
                    head_sha: "c".repeat(40),
                    created_at: at,
                    ..build.clone()
                })
                .context("supersede overlapping completion")?;
            }
            Self::Finalize | Self::Requeue | Self::Recover => {
                let current = if matches!(self, Self::Recover) {
                    let Some(current) = q
                        .claim_build(&|| at)
                        .context("claim overlapping recovery")?
                    else {
                        return Ok(false);
                    };
                    assert_eq!(current.id, build.id);
                    current
                } else {
                    q.build_by_id(build.id)
                        .context("read finalization fence")?
                        .unwrap()
                };
                let published = current.publication_id.is_some();
                let state = if published {
                    BuildState::Published
                } else if matches!(self, Self::Finalize) {
                    BuildState::Failed
                } else {
                    BuildState::Queued
                };
                let finish = BuildFinish {
                    state,
                    failure_cause: (state == BuildState::Failed).then_some(BuildFailure::Exit),
                    exit_code: None,
                    at,
                    next_attempt_at: at + Duration::seconds(60),
                };
                if q.finish_build(current.id, current.lease_token, &finish)
                    .context("finish overlapping build")?
                {
                    q.fail_build_uploads(
                        current.id,
                        current.started_at.unwrap(),
                        PublicationFailure::Expired,
                        at,
                    )
                    .context("close overlapping uploads")?;
                }
            }
        }
        Ok(true)
    }
}
