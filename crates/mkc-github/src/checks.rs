//! Check-run list, create, update and rerequest provider adapter.

use mkc_github_interface::checks::{CheckRun, Checks, Create, Status, Update};
use mkc_github_interface::error::{Error, Result};
use mkc_github_interface::http::Method;
use serde::Deserialize;
use thiserror::Error;

use crate::client::{GitHub, json, repository_path};
use crate::response;

#[derive(Deserialize)]
struct Page {
    check_runs: Vec<CheckRun>,
}

#[derive(Debug, Error)]
#[error("[mkc-github/checks] check pagination exceeded one hundred pages")]
struct PaginationLimit;

impl Checks for GitHub {
    fn list(
        &self,
        installation: i64,
        repository: &str,
        head_sha: &str,
        app_id: i64,
    ) -> Result<Vec<CheckRun>> {
        if app_id <= 0
            || !matches!(head_sha.len(), 40 | 64)
            || !head_sha.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(Error::InvalidRequest);
        }
        let root = repository_path(repository)?;
        let mut runs = Vec::new();
        for page in 1..=100 {
            let result: Page = response::decode(self.installed(
                installation,
                Method::Get,
                format!("{root}/commits/{head_sha}/check-runs?check_name=Mokly&app_id={app_id}&filter=all&per_page=100&page={page}"),
                None,
            )?)?;
            let complete = result.check_runs.len() < 100;
            runs.extend(result.check_runs);
            if complete {
                return Ok(runs);
            }
        }
        Err(Error::internal(PaginationLimit))
    }

    fn create(&self, installation: i64, repository: &str, input: &Create) -> Result<CheckRun> {
        validate(&input.update)?;
        let root = repository_path(repository)?;
        response::decode(self.installed(
            installation,
            Method::Post,
            format!("{root}/check-runs"),
            json(input)?,
        )?)
    }

    fn update(
        &self,
        installation: i64,
        repository: &str,
        id: i64,
        input: &Update,
    ) -> Result<CheckRun> {
        if id <= 0 {
            return Err(Error::InvalidRequest);
        }
        validate(input)?;
        let root = repository_path(repository)?;
        response::decode(self.installed(
            installation,
            Method::Patch,
            format!("{root}/check-runs/{id}"),
            json(input)?,
        )?)
    }

    fn rerequest(&self, installation: i64, repository: &str, id: i64) -> Result<()> {
        if id <= 0 {
            return Err(Error::InvalidRequest);
        }
        let root = repository_path(repository)?;
        self.installed(
            installation,
            Method::Post,
            format!("{root}/check-runs/{id}/rerequest"),
            Some("{}".to_owned()),
        )?;
        Ok(())
    }
}

fn validate(input: &Update) -> Result<()> {
    if (input.status == Status::Completed) != input.conclusion.is_some() {
        return Err(Error::InvalidRequest);
    }
    Ok(())
}
