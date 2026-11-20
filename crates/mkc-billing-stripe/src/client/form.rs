//! Deterministic form construction and catalogue idempotency keys.

use std::collections::BTreeMap;

use sha2::{Digest, Sha256};

use mkc_billing_interface::catalogue_provider::RunId;

pub(super) fn push_metadata(form: &mut Vec<(String, String)>, metadata: &BTreeMap<String, String>) {
    for (key, value) in metadata {
        form.push((format!("metadata[{key}]"), value.clone()));
    }
}

pub(super) fn push_subscription_metadata(
    form: &mut Vec<(String, String)>,
    metadata: &BTreeMap<String, String>,
) {
    for (key, value) in metadata {
        form.push((format!("subscription_data[metadata][{key}]"), value.clone()));
    }
}

pub(crate) fn sorted_form(mut form: Vec<(String, String)>) -> Vec<(String, String)> {
    form.sort_by(|left, right| {
        left.0
            .as_bytes()
            .cmp(right.0.as_bytes())
            .then_with(|| left.1.as_bytes().cmp(right.1.as_bytes()))
    });
    form
}

pub(crate) fn catalogue_idempotency_key(
    run: &RunId,
    operation: &str,
    target: &str,
    body: &[u8],
) -> String {
    let digest = Sha256::digest(body);
    let prefix = digest[..16]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!(
        "mokly-catalogue:{}:{operation}:{target}:{prefix}",
        run.as_str()
    )
}
