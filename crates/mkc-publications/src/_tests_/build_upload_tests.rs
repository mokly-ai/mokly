//! Build bearers resolve through database grant and live-attempt boundaries.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::{BuildUploadGrant, BuildUploadGrantsMock};
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::project::ProjectsMock;
use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::ingest::{Ingest, PublicationIngest, UploadAuthorization};
use crate::policy::DatabaseAccessPolicy;
use crate::upload_authorization::{Credential, UploadPolicy};

use super::build_fixtures::{BUILD, PROJECT, build, project};
use super::support::{clock, now, organization_query, transactions};

fn bearer() -> String {
    format!("mkb_{}", "a".repeat(64))
}

fn grant() -> BuildUploadGrant {
    BuildUploadGrant {
        id: Uuid::from_u128(30),
        build_id: BUILD,
        attempt: 1,
        token_digest: Sha256::digest(bearer().as_bytes()).into(),
        expires_at: now() + Duration::minutes(15),
        consumed_at: None,
        outcome: None,
        created_at: now(),
    }
}

fn service(queries: Unimock, runtime: Arc<dyn Runtime>) -> PublicationIngest {
    let empty = Arc::new(Unimock::new(()));
    PublicationIngest {
        transactions: transactions(queries),
        runtime,
        policy: Arc::new(DatabaseAccessPolicy),
        validator: empty.clone(),
        writer: empty.clone(),
        files: empty,
    }
}

#[test]
fn a_build_bearer_authorizes_against_its_live_database_attempt() {
    let queries = Unimock::new((
        BuildUploadGrantsMock::build_grant
            .next_call(matching!(_))
            .answers(&|_, digest| {
                assert_eq!(digest, &grant().token_digest);
                Ok(Some(grant()))
            }),
        BuildsMock::build_by_id
            .next_call(matching!(&BUILD))
            .returns(Ok(Some(build(BuildState::Running)))),
        ProjectsMock::project
            .next_call(matching!(&PROJECT))
            .returns(Ok(Some(project()))),
        organization_query(),
    ));
    let ingest = service(queries, clock());
    assert!(ingest.authorize(PROJECT, &bearer()).is_ok());
}

#[test]
fn malformed_build_bearers_use_no_clock_or_database() {
    let empty = Arc::new(Unimock::new(()));
    let ingest = PublicationIngest {
        transactions: empty.clone(),
        runtime: empty.clone(),
        policy: empty.clone(),
        validator: empty.clone(),
        writer: empty.clone(),
        files: empty,
    };
    for bearer in [
        "mkb_".to_owned(),
        format!("mkb_{}", "A".repeat(64)),
        format!("mkb_{}", "g".repeat(64)),
        format!("mkb_{}", "a".repeat(63)),
        format!("mkb_{}", "a".repeat(65)),
        format!("mkb_{} ", "a".repeat(64)),
    ] {
        assert!(matches!(
            ingest.authorize(PROJECT, &bearer),
            Err(Error::Unauthorized)
        ));
    }
}

#[test]
fn stale_leases_attempts_states_deadlines_and_consumption_are_typed_refusals() {
    for case in 0..8 {
        let mut build = build(BuildState::Running);
        let mut grant = grant();
        match case {
            0 => build.state = BuildState::Queued,
            1 => build.state = BuildState::Cancelled,
            2 => build.state = BuildState::Superseded,
            3 => build.lease_expires_at = Some(now()),
            4 => build.deadline_at = Some(now()),
            5 => build.attempt += 1,
            6 => grant.expires_at = now(),
            _ => grant.consumed_at = Some(now()),
        }
        let ingest = service(
            Unimock::new((
                BuildUploadGrantsMock::build_grant
                    .next_call(matching!(_))
                    .returns(Ok(Some(grant))),
                BuildsMock::build_by_id
                    .next_call(matching!(_))
                    .returns(Ok(Some(build))),
            )),
            clock(),
        );
        assert!(matches!(
            ingest.authorize(PROJECT, &bearer()),
            Err(Error::Unauthorized)
        ));
    }
}

#[test]
fn an_authorization_handle_rechecks_the_database_inside_each_transaction() {
    let authorization = UploadAuthorization {
        project: PROJECT,
        credential: Credential::Build(grant().token_digest),
        build_id: Some(BUILD),
        organization_slug: super::support::organization_slug(),
        project_slug: super::support::project_slug(),
    };
    let empty = Arc::new(Unimock::new(()));
    let ingest = PublicationIngest {
        transactions: empty.clone(),
        runtime: empty.clone(),
        policy: Arc::new(DatabaseAccessPolicy),
        validator: empty.clone(),
        writer: empty.clone(),
        files: empty,
    };
    for completion in [None, Some(super::support::PUBLICATION)] {
        let mut queries = Unimock::new(
            BuildUploadGrantsMock::build_grant
                .next_call(matching!(_))
                .returns(Ok(None)),
        );
        assert!(matches!(
            ingest.check(&mut queries, &authorization, completion, now()),
            Err(Error::Unauthorized)
        ));
    }
    let mut queries = Unimock::new((
        BuildUploadGrantsMock::build_grant
            .next_call(matching!(_))
            .returns(Ok(Some(grant()))),
        BuildsMock::build_by_id
            .next_call(matching!(_))
            .returns(Ok(Some(build(BuildState::Running)))),
        ProjectsMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(super::support::project()))),
        organization_query(),
    ));
    assert!(matches!(
        ingest.check(&mut queries, &authorization, None, now()),
        Err(Error::PlanRequired)
    ));
}
