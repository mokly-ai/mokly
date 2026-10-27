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
            blob_encoding: if document
                .blob_encodings
                .as_ref()
                .is_some_and(|raw| offers_gzip(raw.get()))
            {
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

fn offers_gzip(raw: &str) -> bool {
    let bytes = raw.as_bytes();
    let mut index = 0;
    skip_whitespace(bytes, &mut index);
    if bytes.get(index) != Some(&b'[') {
        return false;
    }
    index += 1;
    loop {
        skip_whitespace(bytes, &mut index);
        if bytes.get(index) == Some(&b']') {
            return false;
        }
        let start = index;
        let Some(end) = item_end(bytes, &mut index) else {
            return false;
        };
        if serde_json::from_slice::<String>(&bytes[start..end])
            .ok()
            .is_some_and(|value| value == "gzip")
        {
            return true;
        }
        skip_whitespace(bytes, &mut index);
        match bytes.get(index) {
            Some(b',') => index += 1,
            Some(b']') => return false,
            _ => return false,
        }
    }
}

fn skip_whitespace(bytes: &[u8], index: &mut usize) {
    while bytes.get(*index).is_some_and(u8::is_ascii_whitespace) {
        *index += 1;
    }
}

fn item_end(bytes: &[u8], index: &mut usize) -> Option<usize> {
    let start = *index;
    let mut depth = 0usize;
    let mut quoted = false;
    let mut escaped = false;
    while let Some(byte) = bytes.get(*index).copied() {
        if quoted {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                quoted = false;
            }
        } else {
            match byte {
                b'"' => quoted = true,
                b'[' | b'{' => depth = depth.checked_add(1)?,
                b']' | b'}' if depth > 0 => depth -= 1,
                b',' | b']' if depth == 0 => {
                    let mut end = *index;
                    while end > start && bytes[end - 1].is_ascii_whitespace() {
                        end -= 1;
                    }
                    return Some(end);
                }
                _ => {}
            }
        }
        *index += 1;
    }
    None
}
