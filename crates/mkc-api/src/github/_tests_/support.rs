//! Deterministic GitHub service collaborators implemented through unimock.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{RuntimeMock, hash};
use mkc_auth::service::Identity;
use mkc_auth::session_policy;
use mkc_domain::ids::{InstallationId, OrganizationId, RepositoryId, UserId};
use mkc_domain::values::Role;
use mkc_github_interface::repositories::{Account, AccountKind};
use mkc_store_interface::github_identity::OAuthFlow;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::member::Member;
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::github::service::{GitHubService, Navigation};

pub(super) const USER: UserId = UserId(Uuid::from_u128(7));
pub(super) const WORKSPACE: OrganizationId = OrganizationId(Uuid::from_u128(8));
pub(super) const INSTALLATION: InstallationId = InstallationId(Uuid::from_u128(9));
pub(super) const REPOSITORY: RepositoryId = RepositoryId(Uuid::from_u128(10));
pub(super) const RETURN_TO: &str = "/mokly/cloud?selection=one%26two&tag=alpha%2Bbeta&note=release%23one&branch=équipe/東京&view=changes&view=browse";

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

pub(super) fn user() -> User {
    User {
        id: USER,
        email: "octocat@example.com".into(),
        name: "Person".into(),
        created_at: now(),
    }
}

pub(super) fn github_user() -> Account {
    Account {
        id: 1,
        login: "octocat".into(),
        kind: AccountKind::User,
    }
}

pub(super) fn identity() -> Identity {
    Identity {
        user: user(),
        session: session_policy::new_session(USER, "previous", "csrf", now()),
    }
}

pub(super) fn member(role: Role) -> Member {
    Member {
        id: Uuid::from_u128(11).into(),
        organization_id: WORKSPACE,
        user_id: Some(USER),
        email: user().email,
        role,
        version: 1,
        expires_at: None,
    }
}

pub(super) fn flow() -> OAuthFlow {
    OAuthFlow {
        state_hash: hash(&"a".repeat(64)),
        verifier_hash: hash(&"b".repeat(64)),
        purpose: FlowPurpose::SignIn,
        user_id: None,
        session_hash: None,
        organization_id: None,
        installation_id: None,
        return_to: RETURN_TO.into(),
        expires_at: now() + Duration::minutes(10),
        used_at: None,
    }
}

pub(super) fn service(queries: Unimock) -> GitHubService {
    let mut service = pure();
    service.store = Arc::new(Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            })),
    ));
    service
}

pub(super) fn read_service(queries: Unimock) -> GitHubService {
    let mut service = pure();
    service.store = Arc::new(Unimock::new(
        StoreMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            })),
    ));
    service
}

pub(super) fn pure() -> GitHubService {
    GitHubService {
        store: Arc::new(Unimock::new(())),
        runtime: Arc::new(
            Unimock::new((
                RuntimeMock::now
                    .some_call(matching!())
                    .returns(now())
                    .at_least_times(0),
                RuntimeMock::id
                    .some_call(matching!())
                    .returns(Uuid::from_u128(20))
                    .at_least_times(0),
                RuntimeMock::secret
                    .some_call(matching!())
                    .answers(&|_| Ok("c".repeat(64)))
                    .at_least_times(0),
            ))
            .no_verify_in_drop(),
        ),
        identities: Arc::new(Unimock::new(())),
        repositories: Arc::new(Unimock::new(())),
        tokens: Arc::new(Unimock::new(())),
        verifier: Arc::new(Unimock::new(())),
        navigation: Navigation {
            app_origin: "https://app.example.com".into(),
            web_origin: "https://github.com".into(),
            client_id: "Iv1.fixture".into(),
            app_slug: "mokly-test".into(),
            app_id: 123,
        },
    }
}
