//! Content-coding negotiation for catalogue file representations.

use crate::catalogue::FileFraming;

pub(crate) const MINIMUM_COMPRESSIBLE_BYTES: u64 = 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Coding {
    Identity,
    Gzip,
    Brotli,
}

impl Coding {
    pub(crate) fn header(self) -> Option<&'static str> {
        match self {
            Self::Identity => None,
            Self::Gzip => Some("gzip"),
            Self::Brotli => Some("br"),
        }
    }
}

#[derive(Clone, Copy, Default)]
struct Preferences {
    gzip: Option<u16>,
    brotli: Option<u16>,
    identity: Option<u16>,
    wildcard: Option<u16>,
}

/// Select the representation used by the corresponding GET, HEAD or 304.
pub(crate) fn negotiate(
    accept_encoding: Option<&str>,
    status: u16,
    framing: FileFraming,
    cache: &str,
    content_type: &str,
) -> Coding {
    let length = match framing {
        FileFraming::Full(length) | FileFraming::NotModified(length)
            if matches!(status, 200 | 304) =>
        {
            length
        }
        FileFraming::Partial(_) | FileFraming::Unsatisfiable(_) => return Coding::Identity,
        FileFraming::Full(_) | FileFraming::NotModified(_) => return Coding::Identity,
    };
    if length <= MINIMUM_COMPRESSIBLE_BYTES
        || has_no_store(cache)
        || !compressible_content_type(content_type)
    {
        return Coding::Identity;
    }
    choose(parse_preferences(accept_encoding))
}

fn choose(preferences: Preferences) -> Coding {
    let wildcard = preferences.wildcard.unwrap_or(0);
    let identity = preferences.identity.unwrap_or_else(|| {
        if wildcard == 0 && preferences.wildcard.is_some() {
            0
        } else {
            1000
        }
    });
    let candidates = [
        (Coding::Brotli, preferences.brotli.unwrap_or(wildcard), 3_u8),
        (Coding::Gzip, preferences.gzip.unwrap_or(wildcard), 2_u8),
        (Coding::Identity, identity, 1_u8),
    ];
    candidates
        .into_iter()
        .filter(|(_, quality, _)| *quality > 0)
        .max_by_key(|(_, quality, priority)| (*quality, *priority))
        .map_or(Coding::Identity, |(coding, _, _)| coding)
}

fn parse_preferences(value: Option<&str>) -> Preferences {
    let mut preferences = Preferences::default();
    for item in value.into_iter().flat_map(|value| value.split(',')) {
        let mut parts = item.split(';');
        let name = parts.next().unwrap_or_default().trim();
        let Some(quality) = parse_parameters(parts) else {
            continue;
        };
        let target = if name.eq_ignore_ascii_case("br") {
            &mut preferences.brotli
        } else if name.eq_ignore_ascii_case("gzip") || name.eq_ignore_ascii_case("x-gzip") {
            &mut preferences.gzip
        } else if name.eq_ignore_ascii_case("identity") {
            &mut preferences.identity
        } else if name == "*" {
            &mut preferences.wildcard
        } else {
            continue;
        };
        *target = Some(target.map_or(quality, |existing| existing.max(quality)));
    }
    preferences
}

fn parse_parameters<'a>(parts: impl Iterator<Item = &'a str>) -> Option<u16> {
    let mut quality = 1_000;
    for parameter in parts {
        let (name, value) = parameter.trim().split_once('=')?;
        if name.trim().eq_ignore_ascii_case("q") {
            quality = parse_quality(value.trim())?;
        }
    }
    Some(quality)
}

fn parse_quality(value: &str) -> Option<u16> {
    let bytes = value.as_bytes();
    if bytes.is_empty() || !matches!(bytes[0], b'0' | b'1') {
        return None;
    }
    let mut quality = u16::from(bytes[0] - b'0') * 1_000;
    if bytes.len() == 1 {
        return Some(quality);
    }
    if bytes[1] != b'.' || bytes.len() > 5 {
        return None;
    }
    for (digit, factor) in bytes[2..].iter().zip([100_u16, 10, 1]) {
        if !digit.is_ascii_digit() {
            return None;
        }
        quality += u16::from(*digit - b'0') * factor;
    }
    (quality <= 1_000).then_some(quality)
}

fn has_no_store(value: &str) -> bool {
    value
        .split(',')
        .any(|directive| directive.trim().eq_ignore_ascii_case("no-store"))
}

fn compressible_content_type(value: &str) -> bool {
    let mime = value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if mime
        .strip_prefix("text/")
        .is_some_and(|subtype| !subtype.is_empty())
        || mime == "image/svg+xml"
    {
        return true;
    }
    let Some(subtype) = mime.strip_prefix("application/") else {
        return false;
    };
    matches!(subtype, "json" | "javascript" | "xml" | "manifest+json")
        || structured_suffix(subtype, "+json")
        || structured_suffix(subtype, "+xml")
}

fn structured_suffix(subtype: &str, suffix: &str) -> bool {
    subtype
        .strip_suffix(suffix)
        .is_some_and(|prefix| !prefix.is_empty())
}

#[cfg(test)]
#[path = "_tests_/compression_tests.rs"]
mod tests;
