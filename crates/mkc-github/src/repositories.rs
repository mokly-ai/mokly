//! Installed repository and current branch reconciliation reads.

use mkc_github_interface::error::{Error, Result};
use mkc_github_interface::http::{Endpoint, Method, Request};
use mkc_github_interface::repositories::{Branch, Installation, Repositories, Repository};
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use serde::Deserialize;

use crate::client::{GitHub, repository_path};
use crate::response;

#[derive(Deserialize)]
struct Page {
    repositories: Vec<Repository>,
}

impl Repositories for GitHub {
    fn installation(&self, installation: i64) -> Result<Installation> {
        if installation <= 0 {
            return Err(Error::InvalidRequest);
        }
        response::decode(self.http.send(&Request {
            method: Method::Get,
            endpoint: Endpoint::Api(format!("/app/installations/{installation}")),
            bearer: Some(self.jwt.issue()?),
            body: None,
        })?)
    }

    fn repositories(&self, installation: i64) -> Result<Vec<Repository>> {
        let mut repositories = Vec::new();
        for page in 1..=1000 {
            let result: Page = response::decode(self.installed(
                installation,
                Method::Get,
                format!("/installation/repositories?per_page=100&page={page}"),
                None,
            )?)?;
            let complete = result.repositories.len() < 100;
            repositories.extend(result.repositories);
            if complete {
                return Ok(repositories);
            }
        }
        Err(Error::InvalidRequest)
    }

    fn branch(&self, installation: i64, repository: &str, branch: &str) -> Result<Branch> {
        if branch.is_empty() {
            return Err(Error::InvalidRequest);
        }
        let root = repository_path(repository)?;
        let name = utf8_percent_encode(branch, NON_ALPHANUMERIC);
        response::decode(self.installed(
            installation,
            Method::Get,
            format!("{root}/branches/{name}"),
            None,
        )?)
    }
}
