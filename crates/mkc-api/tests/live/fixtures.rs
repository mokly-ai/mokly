//! Real store fixtures for public and private projects and their sessions.

use std::net::SocketAddr;
use std::path::Path;

use chrono::{DateTime, Utc};
use mkc_auth::session_policy::new_session;
use mkc_config::publications::{FileStorage, PublicationSettings};
use mkc_config::settings::{Mail, Settings};
use mkc_domain::ids::{MemberId, OrganizationId, ProjectId, UserId};
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::error::Result;
use mkc_store_interface::member::Member;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;
use mkc_store_interface::user::User;
use uuid::Uuid;

pub(super) const ORIGIN: &str = "https://app.example.com";
pub(super) const PUBLIC: ProjectId = ProjectId(Uuid::from_u128(1));
pub(super) const PRIVATE: ProjectId = ProjectId(Uuid::from_u128(2));
pub(super) const MEMBERSHIP: MemberId = MemberId(Uuid::from_u128(3));
pub(super) const VISITOR: UserId = UserId(Uuid::from_u128(4));
pub(super) const MEMBER_TOKEN: &str = "member-token";
pub(super) const ROTATE_TOKEN: &str = "rotate-token";
pub(super) const VISITOR_TOKEN: &str = "visitor-token";
pub(super) const EXPIRED_TOKEN: &str = "expired-token";
pub(super) const CSRF: &str = "session-csrf";
const ORGANIZATION: OrganizationId = OrganizationId(Uuid::from_u128(5));
const MEMBER: UserId = UserId(Uuid::from_u128(6));

pub(super) fn seed(queries: &mut dyn Queries, now: DateTime<Utc>) -> Result<()> {
    for (id, email) in [
        (MEMBER, "member@example.com"),
        (VISITOR, "visitor@example.com"),
    ] {
        queries.insert_user(&User {
            id,
            email: email.into(),
            name: email.into(),
            created_at: now,
        })?;
    }
    queries.insert_organization(&Organization {
        id: ORGANIZATION,
        name: "Workspace".into(),
        slug: "live-workspace".parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Team,
    })?;
    queries.insert_member(&Member {
        id: MEMBERSHIP,
        organization_id: ORGANIZATION,
        user_id: Some(MEMBER),
        email: "member@example.com".into(),
        role: Role::Reviewer,
        version: 1,
        expires_at: None,
    })?;
    for (id, slug, visibility) in [
        (PUBLIC, "public-project", Visibility::Public),
        (PRIVATE, "private-project", Visibility::Private),
    ] {
        queries.insert_project(&Project {
            id,
            organization_id: ORGANIZATION,
            name: slug.into(),
            slug: slug.parse().unwrap(),
            repository: format!("https://github.com/fixture/{slug}"),
            config_path: "mokly.config.json".into(),
            visibility,
            require_approval: false,
            automatic_builds: false,
            version: 1,
        })?;
    }
    for (user, token) in [
        (MEMBER, MEMBER_TOKEN),
        (MEMBER, ROTATE_TOKEN),
        (VISITOR, VISITOR_TOKEN),
        (MEMBER, EXPIRED_TOKEN),
    ] {
        let mut session = new_session(user, token, CSRF, now);
        if token == EXPIRED_TOKEN {
            session.expires_at = now;
        }
        queries.insert_session(&session)?;
    }
    Ok(())
}

pub(super) fn settings(database_url: &str, bind: SocketAddr, files: &Path) -> Settings {
    Settings {
        trusted_proxies: Default::default(),
        database_url: database_url.to_owned(),
        bind,
        app_origin: ORIGIN.into(),
        desktop_client: false,
        api_origin: format!("http://{bind}"),
        mail: Mail::Log,
        preview_sign_in: None,
        github: None,
        billing: None,
        builds: None,
        publications: PublicationSettings {
            upload_memory_bytes: 536_870_912,
            upload_blob_gzip: false,
            ingest_workers: 8,
            domain: "catalogues.example.net".into(),
            scheme: "https".into(),
            port: None,
            bind,
            signing_key: "a".repeat(64),
            storage: FileStorage::Local(files.to_owned()),
            hot_cache_bytes: 0,
        },
    }
}
