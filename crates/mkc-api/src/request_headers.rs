//! Header and session-cookie extraction shared by REST and WebSocket requests.

use axum::http::HeaderMap;

pub(crate) fn text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name)?.to_str().ok()
}

pub(crate) fn session_credential(headers: &HeaderMap) -> Option<&str> {
    text(headers, "cookie")?
        .split(';')
        .find_map(|cookie| cookie.trim().strip_prefix("mkc_session="))
}
