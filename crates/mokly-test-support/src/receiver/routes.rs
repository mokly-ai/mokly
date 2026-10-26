//! The receiver's Plan, Blob, and Complete handlers.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use serde_json::{Value, json};

use crate::archive;
use crate::inventory::{self, MARKER, Owned};
use crate::publication::TOKEN;
use crate::server::{Request, Response};

use super::exchange::{Replan, Shared};

/// Answer one exchange request, or panic when the client breaks the exchange.
pub(super) fn route(shared: &Shared, request: &Request) -> Response {
    let token = shared.options.token.as_deref().unwrap_or(TOKEN);
    assert_eq!(
        request.headers.get("authorization"),
        Some(&format!("Bearer {token}"))
    );
    if request.target == "/plan?key=1=2" {
        plan(shared, request)
    } else if let Some(hash) = request.target.strip_prefix("/blobs/") {
        blob(shared, hash, &request.body)
    } else {
        assert_eq!(request.target, "/complete");
        complete(shared)
    }
}

fn plan(shared: &Shared, request: &Request) -> Response {
    let files = archive::files(&request.body);
    let file = |name: &str| {
        files
            .iter()
            .find(|(path, _)| path == name)
            .map(|(_, bytes)| bytes.as_slice())
    };
    let envelope: Value = serde_json::from_slice(file("mokly-upload.json").unwrap()).unwrap();
    let comparison = envelope["comparisonPath"].as_str();
    let mut expected = vec!["mokly-upload.json", MARKER];
    expected.extend(comparison);
    let names: Vec<_> = files.iter().map(|(name, _)| name.as_str()).collect();
    assert_eq!(names, expected);
    if let Some(path) = comparison {
        let review: Value = serde_json::from_slice(file(path).unwrap()).unwrap();
        assert_eq!(review["schemaVersion"], 8);
        assert_eq!(review["baseCommit"], envelope["baseSha"]);
    }
    let marker = file(MARKER).unwrap().to_vec();
    let entries = marker_entries(&marker);
    let (missing, first) = {
        let mut state = shared.state.lock().unwrap();
        state.record.bodies.push(request.body.clone());
        state.identity = format!(
            "{}:{}",
            envelope["headSha"].as_str().unwrap(),
            envelope["configPath"].as_str().unwrap()
        );
        state.record.metadata.push(envelope.clone());
        for entry in &entries {
            if let Some(bytes) = file(&entry.path) {
                state.blobs.insert(entry.sha256.clone(), bytes.to_vec());
            }
        }
        let missing: BTreeSet<_> = entries
            .iter()
            .map(|entry| entry.sha256.clone())
            .filter(|hash| !state.blobs.contains_key(hash))
            .collect();
        let missing: Vec<_> = missing.into_iter().collect();
        state.record.missing_sets.push(missing.clone());
        state.marker = Some(marker);
        state.entries = entries;
        (missing, state.record.bodies.len() == 1)
    };
    if let Some(status) = *shared.plan_status.lock().unwrap() {
        return Response::empty(status, &[]);
    }
    if let Some(hold) = &shared.options.hold_plan {
        return shared.hold(hold);
    }
    if let (Some(status), true) = (shared.options.retry_status, first) {
        return Response::empty(status, &[("Retry-After", "0")]);
    }
    let base = shared.base.get().unwrap();
    let answer = json!({
        "schemaVersion": 1,
        "upload": { "id": "local", "expiresAt": "2099-01-01T00:00:00.000Z" },
        "missing": missing,
        "blobUrl": format!("{base}/blobs/{{sha256}}"),
        "completeUrl": format!("{base}/complete"),
    });
    Response::json(200, answer.to_string().into_bytes())
}

fn blob(shared: &Shared, hash: &str, body: &[u8]) -> Response {
    assert_eq!(inventory::digest(body), hash);
    if let Some(hold) = &shared.options.hold_blob {
        return shared.hold(hold);
    }
    let mut state = shared.state.lock().unwrap();
    let attempts = state.record.attempts.entry(hash.to_owned()).or_insert(0);
    *attempts += 1;
    if let (Some(status), 1) = (shared.options.retry_status, *attempts) {
        return Response::empty(status, &[("Retry-After", "0")]);
    }
    state.blobs.insert(hash.to_owned(), body.to_vec());
    Response::empty(204, &[])
}

fn complete(shared: &Shared) -> Response {
    let received = {
        let mut state = shared.state.lock().unwrap();
        for entry in &state.entries {
            assert_eq!(
                state.blobs.get(&entry.sha256).map(Vec::len),
                Some(entry.size as usize)
            );
        }
        state.record.completion_attempts += 1;
        let first = state.record.completion_attempts == 1;
        if let (Some(status), true) = (shared.options.retry_status, first) {
            return Response::empty(status, &[("Retry-After", "0")]);
        }
        if let (Some(replan), true) = (shared.options.replan, first) {
            if replan == Replan::Nonempty {
                let forgotten = state.record.missing_sets[0][0].clone();
                state.blobs.remove(&forgotten);
            }
            return Response::empty(409, &[]);
        }
        let mut received: BTreeMap<_, _> = state
            .entries
            .iter()
            .map(|entry| (entry.path.clone(), state.blobs[&entry.sha256].clone()))
            .collect();
        received.insert(MARKER.to_owned(), state.marker.clone().unwrap());
        received
    };
    inventory::verify(&received).expect("the receiver accepts the inventory");
    let check = shared.check.lock().unwrap().as_ref().map(Arc::clone);
    if let Some(check) = check {
        check(&received);
    }
    let mut state = shared.state.lock().unwrap();
    state.record.completed_inventories.push(received);
    state.record.completed += 1;
    let identity = state.identity.clone();
    let status = if state.published.insert(identity) {
        201
    } else {
        200
    };
    let base = shared.base.get().unwrap();
    let answer = json!({ "viewerUrl": format!("{base}/catalogue") });
    Response::json(status, answer.to_string().into_bytes())
}

fn marker_entries(marker: &[u8]) -> Vec<Owned> {
    let marker: Value = serde_json::from_slice(marker).unwrap();
    marker["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| Owned {
            path: entry["path"].as_str().unwrap().to_owned(),
            sha256: entry["sha256"].as_str().unwrap().to_owned(),
            size: entry["size"].as_u64().unwrap(),
        })
        .collect()
}
