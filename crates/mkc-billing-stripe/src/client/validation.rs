//! Pre-send validation shared by Stripe provider operations.

use std::collections::{BTreeMap, BTreeSet};

use mkc_billing_interface::error::{Error, Result};

pub(super) fn validate_segment(value: &str) -> Result<&str> {
    if value.is_empty()
        || value.len() > 255
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err(Error::invalid_request());
    }
    Ok(value)
}

pub(super) fn validate_idempotency_key(value: &str) -> Result<()> {
    if value.is_empty() || value.len() > 255 {
        return Err(Error::invalid_request());
    }
    Ok(())
}

pub(super) fn validate_quantity_and_key(quantity: i64, key: &str) -> Result<()> {
    if quantity <= 0 {
        return Err(Error::invalid_request());
    }
    validate_idempotency_key(key)
}

pub(super) fn derived_key(prefix: &str, value: &str) -> Result<String> {
    let key = format!("{prefix}:{value}");
    validate_idempotency_key(&key)?;
    Ok(key)
}

pub(super) fn validate_lookup_key(value: &str) -> Result<()> {
    if value.is_empty() || value.chars().count() > 200 {
        return Err(Error::invalid_request());
    }
    Ok(())
}

pub(super) fn validate_lookup_keys(values: &[String]) -> Result<()> {
    if values.is_empty() || values.len() > 10 {
        return Err(Error::invalid_request());
    }
    let mut unique = BTreeSet::new();
    for value in values {
        validate_lookup_key(value)?;
        if !unique.insert(value) {
            return Err(Error::invalid_request());
        }
    }
    Ok(())
}

pub(super) fn validate_required(value: &str) -> Result<()> {
    if value.is_empty() {
        return Err(Error::invalid_request());
    }
    Ok(())
}

pub(super) fn validate_metadata(metadata: &BTreeMap<String, String>) -> Result<()> {
    if metadata.keys().any(String::is_empty) {
        return Err(Error::invalid_request());
    }
    Ok(())
}
