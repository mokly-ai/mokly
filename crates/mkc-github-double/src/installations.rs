//! The second recorded installation and its administrator and token boundaries.

use chrono::{Duration, Utc};
use serde_json::{Value, json};

use crate::error::{Error, ErrorResultExt, Result};
use crate::mode::Mode;
use crate::received::Received;
use crate::recording::{Recorded, Recording};

const SECOND_TOKEN: &str = "ghs_fixture_organization_token";

pub(crate) fn route(received: &Received, mode: &mut Mode) -> Result<Option<Recording>> {
    if !mode.second_installation {
        return Ok(None);
    }
    let path = received.path.as_str();
    let mint = path == "/app/installations/2/access_tokens";
    let repositories = path == "/installation/repositories?per_page=100&page=1"
        && received.authorization.as_deref() == Some(&format!("Bearer {SECOND_TOKEN}"));
    let covered = mint
        || repositories
        || matches!(
            path,
            "/app/installations/2"
                | "/user/installations?per_page=100&page=1"
                | "/user/memberships/orgs/fixture-org"
        );
    if !covered {
        return Ok(None);
    }
    if received.method != if mint { "POST" } else { "GET" } {
        return Err(received.unrecorded());
    }
    let mut record = match path {
        "/app/installations/2" => installation(mode)?,
        "/user/installations?per_page=100&page=1" => {
            let mut record = Recorded::UserInstallations.response()?;
            record.body["total_count"] = json!(2);
            record.body["installations"] = json!([
                Recorded::Installation.response()?.body,
                installation(mode)?.body,
            ]);
            record
        }
        "/user/memberships/orgs/fixture-org" => Recorded::OrganizationMembership.response()?,
        _ if mint => {
            mode.token_requests += 1;
            if received.body != "{}" {
                let input: Value = serde_json::from_str(&received.body)
                    .context("decode second installation token request")?;
                if input != json!({"repository_ids":[1296270],"permissions":{"contents":"read"}}) {
                    return Err(Error::Field {
                        name: "repository_ids",
                    });
                }
                mode.scoped_token_requests += 1;
            }
            let mut record = Recorded::InstallationToken.response()?;
            record.body["token"] = json!(SECOND_TOKEN);
            record.body["expires_at"] = json!((Utc::now() + Duration::hours(1)).to_rfc3339());
            record
        }
        _ => {
            mode.repository_requests += 1;
            let mut record = Recorded::OrganizationRepositories.response()?;
            if let Some(name) = &mode.second_repository_name {
                record.body["repositories"][0]["full_name"] = json!(name);
            }
            record
        }
    };
    record.headers.insert(
        "x-ratelimit-reset".into(),
        (Utc::now().timestamp() + 3600).to_string(),
    );
    Ok(Some(record))
}

fn installation(mode: &Mode) -> Result<Recording> {
    let mut record = Recorded::OrganizationInstallation.response()?;
    if mode.second_suspended {
        record.body["suspended_at"] = json!(Utc::now().to_rfc3339());
    }
    Ok(record)
}

#[cfg(test)]
#[path = "_tests_/installation_tests.rs"]
mod installation_tests;
