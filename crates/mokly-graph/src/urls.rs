//! Strict portable URL decoding for authored references inside the static namespace.

use std::result;

use mokly_model::routes;
use percent_encoding::percent_decode_str;
use thiserror::Error;

/// A local URL cannot grant access outside the static namespace.
#[derive(Clone, Copy, Debug, Error)]
pub enum UrlError {
    /// Controls or whitespace around a URL.
    #[error("[mokly-graph/url] unsafe URL characters")]
    Characters,
    /// An incomplete percent-encoded byte.
    #[error("[mokly-graph/url] malformed URL encoding")]
    Encoding,
    /// Invalid UTF-8 after percent decoding.
    #[error("[mokly-graph/url] malformed UTF-8 URL")]
    Utf8,
    /// A separator or unsafe character appeared inside a decoded segment.
    #[error("[mokly-graph/url] encoded separator or unsafe path")]
    Separator,
    /// The relative reference escaped confinement.
    #[error("[mokly-graph/url] unsafe or escaping URL")]
    Escape,
}

/// Decode a portable local reference and resolve it in the static namespace.
pub fn local_target(source: &str, reference: &str) -> result::Result<Option<String>, UrlError> {
    if reference.starts_with('#') || reference.is_empty() {
        return Ok(None);
    }
    let lower = reference.to_ascii_lowercase();
    if ["http:", "https:", "data:", "mailto:", "tel:"]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
        || reference.starts_with("//")
    {
        return Ok(None);
    }
    let path = reference.split(['?', '#']).next().unwrap_or(reference);
    let decoded = decode_path(path)?;
    let target = routes::resolve(source, &decoded)
        .filter(|path| path.starts_with("static/"))
        .ok_or(UrlError::Escape)?;
    Ok(Some(target))
}

/// Decode each path segment once and reject encoded separators and malformed bytes.
pub fn decode_path(path: &str) -> result::Result<String, UrlError> {
    if path.trim() != path || path.chars().any(char::is_control) {
        return Err(UrlError::Characters);
    }
    for (index, byte) in path.bytes().enumerate() {
        if byte == b'%'
            && (!path
                .as_bytes()
                .get(index + 1)
                .is_some_and(u8::is_ascii_hexdigit)
                || !path
                    .as_bytes()
                    .get(index + 2)
                    .is_some_and(u8::is_ascii_hexdigit))
        {
            return Err(UrlError::Encoding);
        }
    }
    let mut decoded = Vec::new();
    for part in path.split('/') {
        let part = match percent_decode_str(part).decode_utf8() {
            Ok(part) => part,
            Err(_) => return Err(UrlError::Utf8),
        };
        if part.contains(['/', '\\', ':', '\0']) {
            return Err(UrlError::Separator);
        }
        decoded.push(part.into_owned());
    }
    Ok(decoded.join("/"))
}

/// Decode an HTML fragment once without treating it as a path segment.
pub fn decode_fragment(fragment: &str) -> result::Result<String, UrlError> {
    for (index, byte) in fragment.bytes().enumerate() {
        if byte == b'%'
            && (!fragment
                .as_bytes()
                .get(index + 1)
                .is_some_and(u8::is_ascii_hexdigit)
                || !fragment
                    .as_bytes()
                    .get(index + 2)
                    .is_some_and(u8::is_ascii_hexdigit))
        {
            return Err(UrlError::Encoding);
        }
    }
    match percent_decode_str(fragment).decode_utf8() {
        Ok(value) => Ok(value.into_owned()),
        Err(_) => Err(UrlError::Utf8),
    }
}
