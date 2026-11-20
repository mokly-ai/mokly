//! Repository reads: the recorded pull request and branch answers.

use serde_json::{Value, json};

use crate::error::Result;
use crate::mode::Mode;
use crate::recording::{Recorded, Recording};

/// The one recorded pull request; every other pull request is absent.
const PULL_REQUEST_PATH: &str = "/repos/octocat/Hello-World/pulls/42";
/// The branch every inexact branch read redirects to.
const RECORDED_BRANCH: &str = "feature%2Fcatalogue";

/// Answer a pull request read, running the scenario's pull hook first.
pub(crate) fn pull_request(path: &str, mode: &mut Mode) -> Result<Recording> {
    if path != PULL_REQUEST_PATH {
        return Recorded::NotFound.response();
    }
    if let Some(hook) = mode.pull_hook.take() {
        hook();
    }
    let mut record = Recorded::PullRequest.response()?;
    if let Some(sha) = &mode.head_sha {
        record.body["head"]["sha"] = json!(sha);
    }
    if mode.fork_pull {
        record.body["head"]["repo"]["id"] = json!(999);
    }
    if mode.missing_pull_repository {
        record.body["head"]["repo"] = Value::Null;
    }
    if mode.closed_pull {
        record.body["state"] = json!("closed");
    }
    Ok(record)
}

/// Answer a branch read, redirecting any target other than the current one.
pub(crate) fn branch(path: &str, mode: &mut Mode) -> Result<Recording> {
    mode.branch_paths.push(path.to_owned());
    if let Some(hook) = mode.branch_hook.take() {
        hook();
    }
    let requested = path.split("/branches/").nth(1).unwrap_or_default();
    let branch = match &mode.branch_name {
        Some(name) => name.clone(),
        None if mode.exact_branch_reads => requested.to_owned(),
        None => RECORDED_BRANCH.to_owned(),
    };
    let current = format!("/repos/{}/branches/{branch}", mode.repository());
    if path != current {
        let mut record = Recorded::NotFound.response()?;
        record.status = 301;
        record.body["message"] = json!("Moved Permanently");
        record.headers.insert("location".into(), current);
        return Ok(record);
    }
    if let Some(status) = mode.branch_status {
        let mut record = Recorded::Unavailable.response()?;
        record.status = status;
        if status == 429 {
            record.headers.insert("retry-after".into(), "1".into());
        }
        return Ok(record);
    }
    if mode.fail_next_branch {
        mode.fail_next_branch = false;
        return Recorded::Unavailable.response();
    }
    if mode.branch_deleted {
        return Recorded::NotFound.response();
    }
    let mut record = Recorded::Branch.response()?;
    if mode.exact_branch_reads {
        record.body["name"] = json!(decoded(&branch));
    }
    if let Some(sha) = &mode.head_sha {
        record.body["commit"]["sha"] = json!(sha);
    }
    Ok(record)
}

/// Decode one percent-encoded path segment the way GitHub reads a branch name.
fn decoded(segment: &str) -> String {
    let encoded = format!("name={segment}");
    url::form_urlencoded::parse(encoded.as_bytes())
        .next()
        .map(|(_, name)| name.into_owned())
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "_tests_/repos_tests.rs"]
mod repos_tests;
