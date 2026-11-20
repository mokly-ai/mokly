//! The recorded route table, as one pure function over the scenario state.

use chrono::{Duration, Utc};
use serde_json::{Value, json};

use crate::checks;
use crate::error::{Error, ErrorResultExt, Result};
use crate::installations;
use crate::mode::Mode;
use crate::received::{Received, TOKEN_PATH};
use crate::recording::{Recorded, Recording};
use crate::repos;

const TOKEN_MINT_PATH: &str = "/app/installations/1/access_tokens";
const INSTALLATION_PATH: &str = "/app/installations/1";
const REPOSITORIES_PATH: &str = "/installation/repositories?per_page=100&page=1";
const EMAILS_PATH: &str = "/user/emails?per_page=100&page=1";
const USER_INSTALLATIONS_PATH: &str = "/user/installations?per_page=100&page=1";

/// Provider ID of the first repository in the installation's recording.
pub const RECORDED_REPOSITORY_ID: i64 = 1_296_269;

/// Answer one request from the recordings, advancing the scenario state.
///
/// Check runs answer from the runs stored so far; every other answer carries a
/// rate-limit reset an hour away.
pub fn route(received: &Received, mode: &mut Mode) -> Result<Recording> {
    received.verify()?;
    if let Some(record) = checks::route(received, mode)? {
        return Ok(record);
    }
    if let Some(record) = installations::route(received, mode)? {
        return Ok(record);
    }
    let path = received.path.as_str();
    let writes = path == TOKEN_PATH || path == TOKEN_MINT_PATH;
    if received.method != if writes { "POST" } else { "GET" } {
        return Err(received.unrecorded());
    }
    let mut record = match path {
        TOKEN_PATH => token(received, mode)?,
        TOKEN_MINT_PATH => mint(received, mode)?,
        INSTALLATION_PATH if mode.uninstalled => Recorded::NotFound.response()?,
        INSTALLATION_PATH => installation(mode)?,
        REPOSITORIES_PATH => repositories(mode)?,
        "/user" => Recorded::User.response()?,
        EMAILS_PATH => emails(mode)?,
        USER_INSTALLATIONS_PATH => Recorded::UserInstallations.response()?,
        path if path.starts_with("/repos/") && path.contains("/pulls/") => {
            repos::pull_request(path, mode)?
        }
        path if path.starts_with("/repos/") && path.contains("/branches/") => {
            repos::branch(path, mode)?
        }
        _ => return Err(received.unrecorded()),
    };
    record.headers.insert(
        "x-ratelimit-reset".into(),
        (Utc::now().timestamp() + 3600).to_string(),
    );
    Ok(record)
}

fn token(received: &Received, mode: &mut Mode) -> Result<Recording> {
    let body: Value = serde_json::from_str(&received.body).context("decode OAuth token request")?;
    for (name, expected) in [
        ("client_id", mode.client_id.clone()),
        ("client_secret", mode.client_secret.clone()),
        ("redirect_uri", mode.redirect_uri()),
    ] {
        if body[name].as_str() != Some(expected.as_str()) {
            return Err(Error::OAuth { name });
        }
    }
    if body["code_verifier"].as_str().map(str::len) != Some(64) {
        return Err(Error::OAuth {
            name: "code_verifier",
        });
    }
    mode.oauth_requests += 1;
    Recorded::OAuthToken.response()
}

/// Mint an installation token; a scoped request reads one repository's contents.
fn mint(received: &Received, mode: &mut Mode) -> Result<Recording> {
    mode.token_requests += 1;
    let mut record = if received.body == "{}" {
        Recorded::InstallationToken.response()?
    } else {
        let input: Value =
            serde_json::from_str(&received.body).context("decode installation token request")?;
        let repository = mode.repository_id.unwrap_or(RECORDED_REPOSITORY_ID);
        if input != json!({ "repository_ids": [repository], "permissions": { "contents": "read" } })
        {
            return Err(Error::Field {
                name: "repository_ids",
            });
        }
        mode.scoped_token_requests += 1;
        Recorded::RepositoryToken.response()?
    };
    record.body["expires_at"] = json!((Utc::now() + Duration::hours(1)).to_rfc3339());
    Ok(record)
}

fn installation(mode: &Mode) -> Result<Recording> {
    let mut record = Recorded::Installation.response()?;
    if mode.suspended {
        record.body["suspended_at"] = json!(Utc::now().to_rfc3339());
    }
    if mode.all_repositories {
        record.body["repository_selection"] = json!("all");
    }
    Ok(record)
}

fn repositories(mode: &mut Mode) -> Result<Recording> {
    mode.repository_requests += 1;
    let mut record = Recorded::Repositories.response()?;
    if let Some(name) = &mode.repository_name {
        record.body["repositories"][0]["full_name"] = json!(name);
    }
    if let Some(id) = mode.repository_id {
        record.body["repositories"][0]["id"] = json!(id);
    }
    record.body["repositories"][0]["private"] = json!(mode.private);
    if let Some(branch) = &mode.default_branch {
        record.body["repositories"][0]["default_branch"] = json!(branch);
    }
    if mode.no_repositories {
        record.body["repositories"] = json!([]);
        record.body["total_count"] = json!(0);
    }
    Ok(record)
}

fn emails(mode: &Mode) -> Result<Recording> {
    let mut record = Recorded::Emails.response()?;
    if let Some(email) = &mode.primary_email {
        record.body[0]["email"] = json!(email);
    }
    Ok(record)
}

#[cfg(test)]
#[path = "_tests_/routes_tests.rs"]
mod routes_tests;
