//! Plan v1 parsing and raw placeholder validation before URL normalization.

use std::collections::BTreeSet;

use mokly_model::output::validation::{RESPONSE_LIMIT, hexadecimal, timestamp};
use mokly_model::versions::PLAN_EXCHANGE;
use serde::Deserialize;
use serde_json::value::RawValue;
use url::Url;

use crate::error::{Error, Result};
use crate::http::{Body, Encoding, Response, is_json};
use crate::settings::Settings;

/// Validated receiver Plan. Its paths are opaque to the client.
#[derive(Clone, Debug)]
pub struct Plan {
    /// Opaque bounded upload id, used only as metadata.
    pub id: String,
    /// UTC expiry in epoch milliseconds.
    pub expires_at: i64,
    /// Strictly ascending distinct marker digests.
    pub missing: Vec<String>,
    /// Raw Blob URL, with exactly one literal path placeholder.
    pub blob_url: String,
    /// Same-origin completion URL.
    pub complete_url: Url,
    /// Encoding offered for Blob bodies in this Plan round.
    pub blob_encoding: Encoding,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    schema_version: f64,
    upload: Upload,
    missing: Vec<String>,
    blob_url: String,
    complete_url: String,
    #[serde(default)]
    blob_encodings: Option<Box<RawValue>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Upload {
    id: String,
    expires_at: String,
}

impl Plan {
    /// Validate the response before any Blob or Complete is sent.
    pub fn parse(
        response: &Response,
        settings: &Settings,
        digests: &BTreeSet<String>,
    ) -> Result<Self> {
        if response.status != 200 || !is_json(response.content_type.as_deref()) {
            return Err(Error::Failed);
        }
        let Body::Bytes(bytes) = &response.body else {
            return Err(Error::Failed);
        };
        if bytes.len() > RESPONSE_LIMIT {
            return Err(Error::Failed);
        }
        let Ok(document) = serde_json::from_slice::<Document>(bytes) else {
            return Err(Error::Failed);
        };
        if document.schema_version != f64::from(PLAN_EXCHANGE)
            || document.upload.id.is_empty()
            || document.upload.id.len() > 255
            || !document
                .missing
                .iter()
                .all(|digest| hexadecimal(digest, &[64]) && digests.contains(digest))
            || document.missing.windows(2).any(|pair| pair[0] >= pair[1])
        {
            return Err(Error::Failed);
        }
        let expires_at = match timestamp(&document.upload.expires_at) {
            Ok(value) => value,
            Err(_) => return Err(Error::Failed),
        };
        let plan = Self {
            id: document.upload.id,
            expires_at,
            missing: document.missing,
            blob_url: document.blob_url,
            complete_url: settings.receiver_url(&document.complete_url)?,
            blob_encoding: if document.blob_encodings.as_deref().is_some_and(offers_gzip) {
                Encoding::Gzip
            } else {
                Encoding::Identity
            },
        };
        plan.blob_target(&"0".repeat(64), settings)?;
        Ok(plan)
    }

    /// Count and substitute the literal placeholder in the raw string first.
    pub fn blob_target(&self, digest: &str, settings: &Settings) -> Result<Url> {
        let Some(index) = self.blob_url.find("{sha256}") else {
            return Err(Error::Failed);
        };
        if self.blob_url.matches("{sha256}").count() != 1
            || self
                .blob_url
                .find(['?', '#'])
                .is_some_and(|boundary| index >= boundary)
        {
            return Err(Error::Failed);
        }
        let url = settings.receiver_url(&self.blob_url.replace("{sha256}", digest))?;
        if !url.path().contains(digest) {
            return Err(Error::Failed);
        }
        Ok(url)
    }
}

/// Keep each item raw so an item serde_json cannot decode is ignored and never
/// fails the Plan.
fn offers_gzip(raw: &RawValue) -> bool {
    serde_json::from_str::<Vec<Box<RawValue>>>(raw.get()).is_ok_and(|items| {
        items
            .iter()
            .any(|item| serde_json::from_str::<String>(item.get()).is_ok_and(|name| name == "gzip"))
    })
}
