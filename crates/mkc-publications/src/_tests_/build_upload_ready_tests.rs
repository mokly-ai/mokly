//! Ready transactions fence changed grants and consume before their commit.

use std::sync::Arc;

use chrono::Duration;
use mkc_store_interface::blob::BlobsMock;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::{BuildUploadGrant, BuildUploadGrantsMock};
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::project::{Project, ProjectsMock};
use mkc_store_interface::publication::{Publication, PublicationState, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use mkc_store_interface::publication_screens::PublicationScreensMock;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::completion_outcome::StoredIndex;
use crate::error::{Error, Result};
use crate::ingest::{Ingested, PublicationIngest, UploadAuthorization};
use crate::reservation::Completion;
use crate::upload_authorization::Credential;

use super::build_fixtures::{BUILD, build, project};
use super::support::{
    PROJECT, PUBLICATION, now, organization_query, organization_slug, project_slug, publication,
    runtime, transactions,
};

fn grant() -> BuildUploadGrant {
    BuildUploadGrant {
        id: Uuid::from_u128(30),
        build_id: BUILD,
        attempt: 1,
        token_digest: [1; 32],
        expires_at: now() + Duration::minutes(15),
        consumed_at: None,
        outcome: None,
        created_at: now(),
    }
}

fn attempt() -> Publication {
    Publication {
        build_id: Some(BUILD),
        build_failure_event_id: Some(uuid::Uuid::from_u128(0x018000000000700080000000000000f1)),
        state: PublicationState::Validating,
        ..publication()
    }
}

fn finish(queries: impl Clause) -> Result<Ingested> {
    finish_with_lock(queries, true)
}

fn finish_with_lock(queries: impl Clause, locked: bool) -> Result<Ingested> {
    let empty = Arc::new(Unimock::new(()));
    let ingest = PublicationIngest {
        transactions: transactions(Unimock::new((
            BuildUploadGrantsMock::lock_build_grant
                .next_call(matching!(_))
                .returns(Ok(locked)),
            queries,
        ))),
        runtime: runtime(),
        policy: empty.clone(),
        validator: empty.clone(),
        writer: empty.clone(),
        files: empty,
    };
    let authorization = UploadAuthorization {
        project: PROJECT,
        credential: Credential::Build(grant().token_digest),
        build_id: Some(BUILD),
        organization_slug: organization_slug(),
        project_slug: project_slug(),
    };
    ingest.finish(
        &authorization,
        &attempt(),
        &attempt().metadata.unwrap(),
        &StoredIndex::Loaded(Box::new(super::index_fixture::current_only())),
    )
}

#[test]
fn a_missing_grant_lock_stops_completion_before_authorization_or_publication_writes() {
    assert!(matches!(
        finish_with_lock((), false),
        Err(Error::Unauthorized)
    ));
}

#[test]
fn a_changed_grant_or_build_blocks_the_ready_transaction_before_publication_writes() {
    for case in 0..5 {
        let mut grant = grant();
        let mut build = build(BuildState::Running);
        match case {
            0 => grant.expires_at = now(),
            1 => grant.consumed_at = Some(now()),
            2 => build.state = BuildState::Cancelled,
            3 => build.attempt += 1,
            _ => build.lease_expires_at = Some(now()),
        }
        let result = finish((
            BuildUploadGrantsMock::build_grant
                .next_call(matching!(_))
                .returns(Ok(Some(grant))),
            BuildsMock::build_by_id
                .next_call(matching!(&BUILD))
                .returns(Ok(Some(build))),
        ));
        assert!(matches!(result, Err(Error::Unauthorized)));
    }
}

fn live_authorization(project: Project) -> impl Clause {
    (
        BuildUploadGrantsMock::build_grant
            .next_call(matching!(_))
            .returns(Ok(Some(grant()))),
        BuildsMock::build_by_id
            .next_call(matching!(&BUILD))
            .returns(Ok(Some(build(BuildState::Running)))),
        ProjectsMock::project
            .next_call(matching!(&PROJECT))
            .returns(Ok(Some(project))),
        organization_query(),
    )
}

#[test]
fn a_plan_change_blocks_the_ready_transaction_before_publication_writes() {
    assert!(matches!(
        finish(live_authorization(super::support::project())),
        Err(Error::PlanRequired)
    ));
}

#[test]
fn a_consumption_refusal_rejects_the_whole_ready_transaction() {
    let queries = (
        live_authorization(project()),
        PublicationsMock::publication
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(Some(attempt()))),
        PublicationsMock::publication_by_identity
            .next_call(matching!(_, _, _))
            .returns(Ok(None)),
        BlobsMock::pending_publication_blobs
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(vec![])),
        PublicationScreensMock::insert_publication_screen_views
            .next_call(matching!(_, _))
            .returns(Ok(())),
        PublicationsMock::ready_publication
            .next_call(matching!(&PUBLICATION, _))
            .returns(Ok(true)),
        PublicationsMock::insert_branch_alias
            .next_call(matching!(_, _, _))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .next_call(matching!(_))
            .returns(Ok(())),
        BuildUploadGrantsMock::consume_build_grant
            .next_call(matching!(_, &PUBLICATION, _))
            .returns(Ok(false)),
    );
    assert!(matches!(finish(queries), Err(Error::Unauthorized)));
}
