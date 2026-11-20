//! Billing harness identities and complete application settings.

use std::env;
use std::net::SocketAddr;

use chrono::{DateTime, Utc};
use mkc_auth::session_policy;
use mkc_config::billing::BillingSettings;
use mkc_config::publications::{FileStorage, PublicationSettings};
use mkc_config::settings::{Mail, Settings};
use mkc_domain::ids::UserId;
use mkc_store_interface::error::Result;
use mkc_store_interface::store::Queries;
use mkc_store_interface::user::User;
use uuid::Uuid;

use super::harness::APP;
use super::stripe_double::{SECRET_KEY, WEBHOOK_SECRET};

#[derive(Clone)]
pub(super) struct Principal {
    pub(super) user: UserId,
    pub(super) email: String,
    pub(super) credential: String,
    pub(super) csrf: String,
}

pub(super) fn principal(email: &str) -> Principal {
    Principal {
        user: Uuid::now_v7().into(),
        email: email.into(),
        credential: format!("credential-{}", Uuid::now_v7()),
        csrf: format!("csrf-{}", Uuid::now_v7()),
    }
}

pub(super) fn seed_principal(
    queries: &mut dyn Queries,
    principal: &Principal,
    name: &str,
    now: DateTime<Utc>,
) -> Result<()> {
    queries.insert_user(&User {
        id: principal.user,
        email: principal.email.clone(),
        name: name.into(),
        created_at: now,
    })?;
    queries.insert_session(&session_policy::new_session(
        principal.user,
        &principal.credential,
        &principal.csrf,
        now,
    ))
}

pub(super) fn settings(database_url: String, bind: SocketAddr, stripe: &str) -> Settings {
    Settings {
        trusted_proxies: Default::default(),
        database_url,
        bind,
        app_origin: APP.into(),
        desktop_client: false,
        api_origin: "http://127.0.0.1:8080".into(),
        mail: Mail::Log,
        github: None,
        builds: None,
        preview_sign_in: None,
        billing: Some(BillingSettings {
            secret_key: SECRET_KEY.into(),
            webhook_secret: WEBHOOK_SECRET.into(),
            api_origin: stripe.into(),
        }),
        publications: PublicationSettings {
            upload_memory_bytes: 536_870_912,
            upload_blob_gzip: false,
            ingest_workers: 8,
            domain: "catalogues.example.net".into(),
            scheme: "https".into(),
            port: None,
            bind: "127.0.0.1:0".parse().unwrap(),
            signing_key: "a".repeat(64),
            storage: FileStorage::Local(
                env::temp_dir().join(format!("mkc-billing-{}", Uuid::now_v7())),
            ),
            hot_cache_bytes: 0,
        },
    }
}
