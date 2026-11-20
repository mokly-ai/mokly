//! The shared released fixture crosses the running API's real upload exchange.

use std::collections::BTreeMap;
use std::process::Command;
use std::time::Duration;

use mkc_build_interface::request::BuildRequest;
use reqwest::Method;
use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::Value;

use crate::contract_client::ContractRequest;

#[derive(Deserialize)]
struct Catalogue {
    plan: Vec<u8>,
    blobs: BTreeMap<String, Vec<u8>>,
}

pub(super) fn publish(request: &BuildRequest) {
    let output = Command::new("python3")
        .arg(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/github/upload_fixture.py"
        ))
        .args([
            &request.repository.as_str().to_ascii_lowercase(),
            request.head_sha.as_str(),
            request.branch.as_str(),
            request.config_path.as_str(),
            "null",
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let catalogue: Catalogue = serde_json::from_slice(&output.stdout).unwrap();
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    let bearer = request.upload_token.expose();
    let planned = ContractRequest::new(
        &client,
        Method::POST,
        request.upload_endpoint.as_str().to_owned(),
    )
    .bearer_auth(bearer)
    .header("Content-Type", "application/gzip")
    .body(catalogue.plan)
    .send()
    .unwrap();
    assert_eq!(planned.status(), 200, "{}", planned.text().unwrap());
    let plan: Value = planned.json().unwrap();
    for hash in plan["missing"].as_array().unwrap() {
        let hash = hash.as_str().unwrap();
        let uploaded = ContractRequest::new(
            &client,
            Method::PUT,
            plan["blobUrl"].as_str().unwrap().replace("{sha256}", hash),
        )
        .bearer_auth(bearer)
        .header("Content-Type", "application/octet-stream")
        .body(catalogue.blobs[hash].clone())
        .send()
        .unwrap();
        assert_eq!(uploaded.status(), 204, "{}", uploaded.text().unwrap());
    }
    let completed = ContractRequest::new(
        &client,
        Method::POST,
        plan["completeUrl"].as_str().unwrap().to_owned(),
    )
    .bearer_auth(bearer)
    .body(Vec::new())
    .send()
    .unwrap();
    assert!(
        matches!(completed.status().as_u16(), 200 | 201),
        "{}",
        completed.text().unwrap()
    );
}
