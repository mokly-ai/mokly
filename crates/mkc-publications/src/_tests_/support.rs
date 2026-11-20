//! Pure records and unimock-backed transaction/clock fixtures.

use std::io::Cursor;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{Runtime, RuntimeMock, hash};
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId, TokenId, UserId};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_domain::values::{Plan, Visibility};
use mkc_mokly_contract::archive::GzipTarReader;
use mkc_mokly_contract::bundle::{ContractValidator, PlanBundle, UploadValidator};
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::organization::{Organization, OrganizationsMock};
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::publication_event::{EventClaim, PublicationEventsMock};
use mkc_store_interface::token::Token;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::locations::Locations;
use crate::transaction::{QueryWork, Transactions, TransactionsMock};

pub(super) const PROJECT: ProjectId = ProjectId(Uuid::from_u128(1));
pub(super) const PUBLICATION: PublicationId = PublicationId(Uuid::from_u128(2));
pub(super) const USER: UserId = UserId(Uuid::from_u128(3));

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

pub(super) fn project() -> Project {
    Project {
        id: PROJECT,
        organization_id: OrganizationId(Uuid::from_u128(4)),
        name: "Catalogue".into(),
        slug: project_slug(),
        repository: "mokly-ai/mokly-cloud".into(),
        config_path: "mokly.config.json".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    }
}

pub(super) fn organization(plan: Plan) -> Organization {
    Organization {
        id: project().organization_id,
        name: "Mokly".into(),
        slug: organization_slug(),
        version: 1,
        created_at: now(),
        plan,
    }
}

pub(super) fn organization_query() -> impl Clause {
    OrganizationsMock::organization
        .each_call(matching!(_))
        .answers(&|_, _| Ok(Some(organization(Plan::Free))))
}

pub(super) fn organization_slug() -> WorkspaceSlug {
    "mokly".parse().unwrap()
}

pub(super) fn project_slug() -> ProjectSlug {
    "cloud".parse().unwrap()
}

pub(super) fn token() -> Token {
    Token {
        id: TokenId(Uuid::from_u128(5)),
        project_id: PROJECT,
        name: "CI".into(),
        prefix: "mkc_aaaa".into(),
        token_hash: hash(&bearer()),
        created_at: now(),
        last_used_at: None,
        revoked_at: None,
    }
}

pub(super) fn bearer() -> String {
    format!("mkc_{}", "a".repeat(64))
}

pub(super) fn publication() -> Publication {
    Publication {
        id: PUBLICATION,
        project_id: PROJECT,
        metadata: Some(PublicationMetadata {
            branch: "feature".into(),
            head_sha: "b".repeat(40),
            base_ref: None,
            base_sha: None,
            pull_request: None,
            config_path: "mokly.config.json".into(),
            exported_at: now(),
        }),
        state: PublicationState::Ready,
        failure: None,
        changes: Some(Changes::NoComparison),
        created_at: now(),
        deadline: now() + Duration::minutes(60),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    }
}

pub(super) fn locations() -> Locations {
    Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "br-main.preview.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    }
}

pub(super) fn transactions(queries: Unimock) -> Arc<dyn Transactions> {
    Arc::new(Unimock::new(
        TransactionsMock::run
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                work(&mut queries.clone())
            })),
    ))
}

pub(super) fn clock() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new(
        RuntimeMock::now.each_call(matching!()).returns(now()),
    ))
}

pub(super) fn runtime() -> Arc<dyn Runtime> {
    Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id
            .each_call(matching!())
            .returns(PUBLICATION.0),
    )))
}

pub(super) fn bundle() -> PlanBundle {
    let validator = ContractValidator {
        reader: Arc::new(GzipTarReader::new(Arc::new(
            ProcessUploadMemoryBudget::new(512 * 1024 * 1024),
        ))),
        limits: Limits::default(),
    };
    validator
        .validate(&mut Cursor::new(include_bytes!(
            "../../../mkc-mokly-contract/fixtures/plan.tar.gz"
        )))
        .unwrap()
}

/// Mock the five-minute claim and the returned current failure budget.
pub(super) fn claim(attempts: i32, permanent_failures: i32) -> impl Clause {
    PublicationEventsMock::claim_publication_event
        .each_call(matching!(_, _, _, _))
        .answers_arc(Arc::new(move |_, _, observed, at, until| {
            assert_eq!(observed, attempts);
            assert_eq!(at, now());
            assert_eq!(until, at + Duration::minutes(5));
            Ok(Some(EventClaim {
                attempts: observed + 1,
                permanent_failures,
            }))
        }))
}
