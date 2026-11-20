//! PR read, review and diff-comment provider adapter.

use mkc_github_interface::error::{Error, Result};
use mkc_github_interface::http::Method;
use mkc_github_interface::pull_requests::{
    Comment, Created, PullRequest, PullRequests, Review, State,
};

use crate::client::{GitHub, json, repository_path};
use crate::response;

impl PullRequests for GitHub {
    fn get(&self, installation: i64, repository: &str, number: i64) -> Result<PullRequest> {
        let root = pull_path(repository, number)?;
        response::decode(self.installed(installation, Method::Get, root, None)?)
    }

    fn list(&self, installation: i64, repository: &str, state: State) -> Result<Vec<PullRequest>> {
        let root = repository_path(repository)?;
        let state = match state {
            State::Open => "open",
            State::Closed => "closed",
        };
        let mut requests = Vec::new();
        for page in 1..=1000 {
            let result: Vec<PullRequest> = response::decode(self.installed(
                installation,
                Method::Get,
                format!("{root}/pulls?state={state}&per_page=100&page={page}"),
                None,
            )?)?;
            let complete = result.len() < 100;
            requests.extend(result);
            if complete {
                return Ok(requests);
            }
        }
        Err(Error::InvalidRequest)
    }

    fn review(
        &self,
        installation: i64,
        repository: &str,
        number: i64,
        review: &Review,
    ) -> Result<Created> {
        let root = pull_path(repository, number)?;
        response::decode(self.installed(
            installation,
            Method::Post,
            format!("{root}/reviews"),
            json(review)?,
        )?)
    }

    fn comment(
        &self,
        installation: i64,
        repository: &str,
        number: i64,
        comment: &Comment,
    ) -> Result<Created> {
        let root = pull_path(repository, number)?;
        if comment.line == 0 {
            return Err(Error::InvalidRequest);
        }
        response::decode(self.installed(
            installation,
            Method::Post,
            format!("{root}/comments"),
            json(comment)?,
        )?)
    }
}

fn pull_path(repository: &str, number: i64) -> Result<String> {
    if number <= 0 {
        return Err(Error::InvalidRequest);
    }
    Ok(format!("{}/pulls/{number}", repository_path(repository)?))
}
