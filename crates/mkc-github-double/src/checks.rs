//! Stateful check runs: the double stores what the App creates and updates.

use serde_json::{Value, json};

use crate::error::{Error, ErrorResultExt, Result};
use crate::mode::Mode;
use crate::received::Received;
use crate::recording::{Recorded, Recording};

/// The check run name every Mokly publication and build reports under.
const CHECK_NAME: &str = "Mokly";

/// Answer a check-run request, or `None` when the target is not a check run.
pub(crate) fn route(received: &Received, mode: &mut Mode) -> Result<Option<Recording>> {
    if !received.path.contains("/check-runs") {
        return Ok(None);
    }
    let root = format!("/repos/{}", mode.repository());
    let record = match received.method.as_str() {
        "GET" => list(received, &root, mode)?,
        "POST" if received.path == format!("{root}/check-runs") => create(received, mode)?,
        "PATCH" => update(received, &root, mode)?,
        _ => return Err(received.unrecorded()),
    };
    Ok(Some(record))
}

/// List the App's runs on one commit, as GitHub filters them.
fn list(received: &Received, root: &str, mode: &mut Mode) -> Result<Recording> {
    let Some(sha) = received
        .path
        .strip_prefix(&format!("{root}/commits/"))
        .and_then(|rest| rest.split('/').next())
    else {
        return Err(received.unrecorded());
    };
    let expected = format!(
        "{root}/commits/{sha}/check-runs?check_name={CHECK_NAME}&app_id={}&filter=all&per_page=100&page=1",
        mode.app_id
    );
    if received.path != expected {
        return Err(received.unrecorded());
    }
    mode.check_lists += 1;
    let runs: Vec<Value> = mode
        .check_runs
        .iter()
        .filter(|run| run["head_sha"] == sha)
        .cloned()
        .collect();
    let mut record = Recorded::CheckList.response()?;
    record.body = json!({ "total_count": runs.len(), "check_runs": runs });
    Ok(record)
}

/// Store a new run; a lost create keeps the run but drops its answer.
fn create(received: &Received, mode: &mut Mode) -> Result<Recording> {
    let input = body(received)?;
    if input["name"] != CHECK_NAME {
        return Err(Error::Field { name: "name" });
    }
    let external = input["external_id"].as_str().unwrap_or_default();
    if !external.starts_with("mokly-publication:") && !external.starts_with("mokly-build:") {
        return Err(Error::Field {
            name: "external_id",
        });
    }
    mode.check_creates += 1;
    let mut record = Recorded::CheckCreate.response()?;
    record.body["id"] = json!(3 + mode.check_creates);
    for key in [
        "head_sha",
        "external_id",
        "details_url",
        "status",
        "conclusion",
        "output",
        "name",
    ] {
        record.body[key] = input[key].clone();
    }
    mode.check_runs.push(record.body.clone());
    if mode.lose_create_response {
        mode.lose_create_response = false;
        mode.drop_check_response = true;
    }
    Ok(record)
}

/// Apply the sent fields to a stored run; an unknown run is absent.
fn update(received: &Received, root: &str, mode: &mut Mode) -> Result<Recording> {
    let Some(id) = received
        .path
        .strip_prefix(&format!("{root}/check-runs/"))
        .and_then(|id| id.parse::<i64>().ok())
    else {
        return Err(received.unrecorded());
    };
    let input = body(received)?;
    let Some(fields) = input.as_object() else {
        return Err(Error::Field { name: "body" });
    };
    if let Some(hook) = mode.check_update_hook.take() {
        hook();
    }
    let Some(run) = mode.check_runs.iter_mut().find(|run| run["id"] == id) else {
        return Recorded::NotFound.response();
    };
    for (key, value) in fields {
        run[key.as_str()] = value.clone();
    }
    let stored = run.clone();
    mode.check_updates += 1;
    let mut record = Recorded::CheckUpdate.response()?;
    record.body = stored;
    Ok(record)
}

/// Decode a check-run body; GitHub requires a conclusion exactly when completed.
fn body(received: &Received) -> Result<Value> {
    let input: Value = serde_json::from_str(&received.body).context("decode check run request")?;
    if (input["status"] == "completed") != input.get("conclusion").is_some() {
        return Err(Error::Field { name: "conclusion" });
    }
    Ok(input)
}

#[cfg(test)]
#[path = "_tests_/checks_tests.rs"]
mod checks_tests;
