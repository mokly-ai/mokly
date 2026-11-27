//! Pure host and single-decoding route validation.

use axum::http::uri::Authority;
use mkc_domain::ids::PublicationId;
use mkc_publications::locations::Locations;
use percent_encoding::percent_decode_str;
use uuid::Uuid;

use crate::error::{Error, Result};

/// Indexed Mokly HTML for an iframe that needs a credential.
pub(crate) const ACCESS_START_PATH: &str = "mokly-viewer/client/access-start.html";
/// Indexed Mokly worker with publication-wide scope.
pub(crate) const ACCESS_WORKER_PATH: &str = "mokly-viewer/client/access-worker.js";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Host {
    Publication(PublicationId),
    Branch(String),
}

pub(crate) fn host(value: &str, locations: &Locations) -> Result<Host> {
    let authority: Authority = match value.parse() {
        Ok(value) => value,
        Err(_) => return Err(Error::NotFound),
    };
    if authority.port_u16() != locations.catalogue_port {
        return Err(Error::NotFound);
    }
    let host = authority.host().to_ascii_lowercase();
    let suffix = format!(".{}", locations.catalogue_domain);
    let label = host.strip_suffix(&suffix).ok_or(Error::NotFound)?;
    if let Some(id) = label.strip_prefix("p-") {
        let id: Uuid = match id.parse() {
            Ok(value) => value,
            Err(_) => return Err(Error::NotFound),
        };
        if label != format!("p-{id}") {
            return Err(Error::NotFound);
        }
        Ok(Host::Publication(id.into()))
    } else if label.len() == 42
        && label.starts_with("b-")
        && label[2..]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        Ok(Host::Branch(label.to_owned()))
    } else {
        Err(Error::NotFound)
    }
}

pub(crate) fn path(value: &str) -> Result<String> {
    let relative = value.strip_prefix('/').ok_or(Error::InvalidRequest)?;
    if relative.len() > 3 * 1024 {
        return Err(Error::InvalidRequest);
    }
    if relative.is_empty() {
        return Ok(String::new());
    }
    let mut decoded = Vec::new();
    for (index, segment) in relative.split('/').enumerate() {
        if segment.is_empty() {
            if relative.ends_with('/') && index == relative.split('/').count() - 1 {
                decoded.push(String::new());
                continue;
            }
            return Err(Error::InvalidRequest);
        }
        let bytes = segment.as_bytes();
        for position in 0..bytes.len() {
            if bytes[position] == b'%'
                && (position + 2 >= bytes.len()
                    || !bytes[position + 1].is_ascii_hexdigit()
                    || !bytes[position + 2].is_ascii_hexdigit())
            {
                return Err(Error::InvalidRequest);
            }
        }
        let segment = match percent_decode_str(segment).decode_utf8() {
            Ok(value) => value,
            Err(_) => return Err(Error::InvalidRequest),
        };
        if matches!(segment.as_ref(), "." | "..")
            || segment
                .chars()
                .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
        {
            return Err(Error::InvalidRequest);
        }
        decoded.push(segment.into_owned());
    }
    let path = decoded.join("/");
    if path.len() > 1024 {
        return Err(Error::InvalidRequest);
    }
    Ok(path)
}

pub(crate) fn with_query(path: &str, query: Option<&str>) -> String {
    match query {
        Some(query) => format!("{path}?{query}"),
        None => path.to_owned(),
    }
}

/// The removed fixed namespace cannot resolve from routes or immutable blob URLs.
pub(crate) fn obsolete_path(path: &str) -> bool {
    path.split('/')
        .next()
        .is_some_and(|root| root.eq_ignore_ascii_case("__mokly"))
}

#[cfg(test)]
#[path = "_tests_/routes_tests.rs"]
mod tests;
