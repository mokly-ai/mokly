//! PKCE code exchange and user-authenticated identity evidence.

use mkc_github_interface::credentials::Secret;
use mkc_github_interface::error::{Error, Result};
use mkc_github_interface::http::{Endpoint, Method, Request};
use mkc_github_interface::identity::{Email, Identities, Membership, OAuthCode};
use mkc_github_interface::repositories::{Account, Installation};
use serde::{Deserialize, Serialize};

use crate::client::{GitHub, json, valid_name};
use crate::response;

#[derive(Serialize)]
struct Exchange<'a> {
    client_id: &'a str,
    client_secret: &'a str,
    code: &'a str,
    code_verifier: &'a str,
    redirect_uri: &'a str,
}

#[derive(Deserialize)]
struct Exchanged {
    access_token: Option<Secret>,
    token_type: Option<String>,
    error: Option<OAuthError>,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum OAuthError {
    BadVerificationCode,
    IncorrectClientCredentials,
    RedirectUriMismatch,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
struct Page {
    installations: Vec<Installation>,
}

impl Identities for GitHub {
    fn exchange(&self, code: &OAuthCode) -> Result<Secret> {
        let result: Exchanged = response::decode(self.http.send(&Request {
            method: Method::Post,
            endpoint: Endpoint::OAuthToken,
            bearer: None,
            body: json(&Exchange {
                client_id: &self.oauth.client_id,
                client_secret: self.oauth.client_secret.expose(),
                code: &code.code,
                code_verifier: &code.verifier,
                redirect_uri: &self.oauth.redirect_uri,
            })?,
        })?)?;
        match result.error {
            Some(OAuthError::BadVerificationCode) => return Err(Error::InvalidCode),
            Some(_) => return Err(Error::Unavailable),
            None => {}
        }
        match result.access_token {
            Some(token)
                if !token.expose().is_empty() && result.token_type.as_deref() == Some("bearer") =>
            {
                Ok(token)
            }
            _ => Err(Error::Unavailable),
        }
    }

    fn user(&self, token: &Secret) -> Result<Account> {
        response::decode(self.user_request(token, "/user".to_owned())?)
    }

    fn emails(&self, token: &Secret) -> Result<Vec<Email>> {
        let mut emails = Vec::new();
        for page in 1..=1000 {
            let result: Vec<Email> = response::decode(
                self.user_request(token, format!("/user/emails?per_page=100&page={page}"))?,
            )?;
            let complete = result.len() < 100;
            emails.extend(result);
            if complete {
                return Ok(emails);
            }
        }
        Err(Error::InvalidRequest)
    }

    fn installations(&self, token: &Secret) -> Result<Vec<Installation>> {
        let mut installations = Vec::new();
        for page in 1..=1000 {
            let result: Page = response::decode(self.user_request(
                token,
                format!("/user/installations?per_page=100&page={page}"),
            )?)?;
            let complete = result.installations.len() < 100;
            installations.extend(result.installations);
            if complete {
                return Ok(installations);
            }
        }
        Err(Error::InvalidRequest)
    }

    fn membership(&self, token: &Secret, organization: &str) -> Result<Membership> {
        if !valid_name(organization) {
            return Err(Error::InvalidRequest);
        }
        response::decode(
            self.user_request(token, format!("/user/memberships/orgs/{organization}"))?,
        )
    }
}
