//! Strict loopback Host, same-origin authorization, and single-pass path decoding.

use axum::http::HeaderMap;
use percent_encoding::percent_decode_str;

pub(crate) fn host(headers: &HeaderMap) -> Option<&str> {
    let mut hosts = headers.get_all("host").iter();
    let host = hosts.next()?.to_str().ok()?;
    if hosts.next().is_some() {
        return None;
    }
    let (name, port) = host.split_once(':')?;
    if !matches!(name, "127.0.0.1" | "localhost")
        || port.starts_with('0')
        || !port.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    let port: u16 = port.parse().ok()?;
    (port > 0).then_some(host)
}

pub(crate) fn authorized(headers: &HeaderMap, token: &str) -> bool {
    let Some(host) = host(headers) else {
        return false;
    };
    let single = |name: &str| {
        let mut values = headers.get_all(name).iter();
        let value = values.next().and_then(|value| value.to_str().ok());
        if values.next().is_some() { None } else { value }
    };
    single("origin") == Some(format!("http://{host}").as_str())
        && single("x-mokly-render-token") == Some(token)
}

pub(crate) fn decode(path: &str) -> Option<String> {
    let relative = path.strip_prefix('/')?;
    if relative.is_empty() {
        return Some(String::new());
    }
    let mut result = Vec::new();
    let mut parts = relative.split('/').peekable();
    while let Some(part) = parts.next() {
        if part.is_empty() && parts.peek().is_none() {
            result.push(String::new());
            break;
        }
        if part.is_empty() {
            return None;
        }
        let bytes = part.as_bytes();
        for (index, byte) in bytes.iter().enumerate() {
            if *byte == b'%'
                && (index + 2 >= bytes.len()
                    || !bytes[index + 1].is_ascii_hexdigit()
                    || !bytes[index + 2].is_ascii_hexdigit())
            {
                return None;
            }
        }
        let decoded = percent_decode_str(part).decode_utf8().ok()?;
        if matches!(decoded.as_ref(), "." | "..")
            || decoded
                .chars()
                .any(|character| character.is_control() || matches!(character, '/' | '\\' | ':'))
        {
            return None;
        }
        result.push(decoded.into_owned());
    }
    Some(result.join("/"))
}

#[cfg(test)]
#[path = "_tests_/security_tests.rs"]
mod security_tests;
