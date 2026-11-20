//! Stored Re-run marks and their real transactional effects.

use chrono::{DateTime, Utc};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_check::CheckRun;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::{Callback, Queries};
use uuid::Uuid;

use super::support::Fixture;

pub(super) fn mark(f: &Fixture, prefix: &str, head: u32) -> (CheckRun, NewBuild) {
    mark_for_project(f, &f.project, prefix, head)
}

pub(super) fn mark_for_project(
    f: &Fixture,
    project: &Project,
    prefix: &str,
    head: u32,
) -> (CheckRun, NewBuild) {
    let mut old = f.build(&format!("branch-{head}"), head);
    old.project_id = project.id;
    old.config_path = project.config_path.clone();
    f.schedule(&old);
    let publication = f.publication(&old);
    let check = CheckRun {
        id: Uuid::from_u128(0x01800000000070008000000000000000 + u128::from(head)),
        project_id: project.id,
        repository_id: f.repository.id,
        github_id: i64::from(head),
        head_sha: old.head_sha.clone(),
        external_id: format!(
            "{prefix}{}",
            if prefix == "mokly-build:" {
                old.id.0
            } else {
                publication.id.0
            }
        ),
        rerequested: true,
    };
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.cancel_build(project.id, old.id, f.now)?;
            q.insert_publication(&publication)?;
            q.save_github_check(&check)
        }))
        .unwrap();
    (
        check,
        NewBuild {
            id: Uuid::now_v7().into(),
            trigger: BuildTrigger::Rerun,
            ..old
        },
    )
}

pub(super) fn consume(
    q: &mut dyn Queries,
    check: &CheckRun,
    build: &NewBuild,
    at: DateTime<Utc>,
) -> Result<()> {
    if check.external_id.starts_with("mokly-build:") {
        q.schedule_build(build)?;
    } else {
        q.insert_publication_event(&PublicationEvent {
            id: Uuid::now_v7(),
            publication_id: check
                .external_id
                .strip_prefix("mokly-publication:")
                .unwrap()
                .parse::<Uuid>()
                .unwrap()
                .into(),
            kind: EventKind::Rerequest,
            created_at: at,
        })?;
    }
    q.clear_github_check_rerequest(check.id)
}
