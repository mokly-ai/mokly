//! Typed replies and publications for seed orchestration tests.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_auth::runtime::RuntimeMock;
use mkc_auth::service::AuthenticatorMock;
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId, TokenId, UserId};
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_publications::ingest::Ingested;
use mkc_publications::locations::Locations;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::payload::{Payload, Reply};
use crate::preview_seed::catalogue::SeedCatalogueMock;
use crate::preview_seed::service::SeedService;
use crate::preview_seed::upload::CatalogueUploadMock;
use crate::views::projects::{ProjectSlugLookupView, ProjectView};
use crate::views::tokens::{TokenCreated, TokenView};
use crate::views::workspaces::{InstallationState, WorkspaceSlugLookupView, WorkspaceView};

pub(super) const HEAD: &str = "1111111111111111111111111111111111111111";

pub(super) fn now() -> DateTime<Utc> {
    "2026-10-30T12:00:00Z".parse().unwrap()
}

pub(super) fn user() -> User {
    User {
        id: UserId(Uuid::from_u128(1)),
        email: "preview@mokly.ai".to_owned(),
        name: "preview@mokly.ai".to_owned(),
        created_at: now(),
    }
}

pub(super) fn workspace() -> Reply {
    Reply::ok(Payload::WorkspaceSlugLookup(WorkspaceSlugLookupView {
        workspace: WorkspaceView {
            id: OrganizationId(Uuid::from_u128(2)),
            name: "Mokly".to_owned(),
            slug: "mokly-ai".parse().unwrap(),
            plan: Plan::Team,
            role: Role::Owner,
            github_installation_state: InstallationState::Absent,
            version: 1,
        },
        canonical_slug: "mokly-ai".parse().unwrap(),
    }))
}

pub(super) fn project() -> Reply {
    Reply::ok(Payload::ProjectSlugLookup(ProjectSlugLookupView {
        project: project_view(),
        canonical_slug: "mokly".parse().unwrap(),
        canonical_workspace_slug: "mokly-ai".parse().unwrap(),
    }))
}

pub(super) fn project_view() -> ProjectView {
    ProjectView {
        id: ProjectId(Uuid::from_u128(3)),
        workspace_id: OrganizationId(Uuid::from_u128(2)),
        name: "Mokly Cloud".to_owned(),
        slug: "mokly".parse().unwrap(),
        workspace_slug: "mokly-ai".parse().unwrap(),
        repository: "mokly-ai/mokly".to_owned(),
        config_path: "mokly.config.json".to_owned(),
        visibility: Visibility::Public,
        require_approval: false,
        can_admin: true,
        publishing_allowed: true,
        automatic_builds: false,
        builds_available: false,
        can_request_builds: false,
        version: 1,
    }
}

pub(super) fn token() -> Reply {
    Reply::created(Payload::Token(TokenCreated {
        token: TokenView {
            id: TokenId(Uuid::from_u128(4)),
            name: "Preview seed".to_owned(),
            prefix: "private".to_owned(),
            created_at: now(),
            last_used_at: None,
            revoked: false,
        },
        secret: "private bearer".to_owned(),
    }))
}

pub(super) fn publication() -> Ingested {
    Ingested {
        publication: Publication {
            id: PublicationId(Uuid::from_u128(5)),
            project_id: ProjectId(Uuid::from_u128(3)),
            build_id: None,
            build_failure_event_id: None,
            metadata: Some(PublicationMetadata {
                branch: "preview".to_owned(),
                head_sha: HEAD.to_owned(),
                base_ref: None,
                base_sha: None,
                pull_request: None,
                config_path: "mokly.config.json".to_owned(),
                exported_at: now(),
            }),
            state: PublicationState::Ready,
            failure: None,
            changes: None,
            created_at: now(),
            deadline: now(),
            expired_at: None,
        },
        organization_slug: "mokly-ai".parse().unwrap(),
        project_slug: "mokly".parse().unwrap(),
        replay: false,
    }
}

pub(super) fn locations() -> Locations {
    Locations {
        app_origin: "https://app.mokly.ai".to_owned(),
        catalogue_domain: "mokly-catalogue.net".to_owned(),
        catalogue_scheme: "https".to_owned(),
        catalogue_port: None,
    }
}

pub(super) fn service(platform: Unimock, files: Unimock) -> SeedService {
    SeedService {
        auth: Arc::new(Unimock::new((
            AuthenticatorMock::preview_sign_in_available
                .some_call(matching!())
                .returns(true),
            AuthenticatorMock::preview_account
                .some_call(matching!())
                .returns(Ok(user())),
        ))),
        platform: Arc::new(platform),
        files: Arc::new(files),
        catalogue: Arc::new(Unimock::new(
            SeedCatalogueMock::read
                .some_call(matching!((run, revision) if *run == "run" && *revision == HEAD))
                .returns(Ok(vec![])),
        )),
        uploader: Arc::new(Unimock::new(
            CatalogueUploadMock::publish
                .some_call(matching!(_, _, _, _))
                .returns(Ok(publication())),
        )),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now.each_call(matching!()).returns(now()),
        )),
        locations: locations(),
        revision: "development",
    }
}
