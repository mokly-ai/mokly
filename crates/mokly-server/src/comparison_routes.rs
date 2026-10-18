//! Strict selected-query parsing and immutable comparison HTTP responses.

use axum::http::{HeaderValue, StatusCode, Uri};
use axum::response::Response;
use mokly_model::namespace::viewer;
use mokly_model::paths::is_entry_path;
use mokly_model::routes;
use percent_encoding::percent_decode_str;

use crate::application::Application;
use crate::{response, security};

pub(crate) async fn route(app: &Application, path: &str, uri: &Uri) -> Option<Response> {
    let rest = path.strip_prefix(&viewer("diffs/"))?;
    let Some(store) = &app.comparisons else {
        return Some(response::missing());
    };
    if rest == "review.json" {
        let Some((path, refresh)) = selection(uri.query().unwrap_or("")) else {
            return Some(response::error(
                StatusCode::BAD_REQUEST,
                "invalid-input",
                "Select a screen or component.",
            ));
        };
        let Some(accepted) = app.publications.current().changes.clone() else {
            return Some(unavailable());
        };
        return Some(match store.selected(accepted, path, refresh).await {
            Ok(id) => {
                let mut response = response::bytes(
                    StatusCode::FOUND,
                    "application/json; charset=utf-8",
                    Default::default(),
                );
                if let Ok(location) =
                    HeaderValue::from_str(&format!("/{}", routes::comparison_review(&id)))
                {
                    response.headers_mut().insert("location", location);
                }
                response
            }
            Err(_) => unavailable(),
        });
    }
    let Some((generation, file)) = path
        .strip_prefix(&routes::comparison_generations())
        .and_then(|rest| rest.split_once('/'))
    else {
        return Some(response::missing());
    };
    if uri.query().is_some() {
        return Some(response::missing());
    }
    Some(match store.file(generation, file).await {
        Ok(Some(file)) => response::bytes(StatusCode::OK, &file.content_type, file.bytes),
        Ok(None) => response::missing(),
        Err(_) => unavailable(),
    })
}

fn unavailable() -> Response {
    response::error(
        StatusCode::SERVICE_UNAVAILABLE,
        "comparison-unavailable",
        "The comparison is unavailable. Try again.",
    )
}

fn selection(query: &str) -> Option<(String, bool)> {
    let mut path = None;
    let mut refresh = None;
    for part in query.split('&') {
        let (key, value) = part.split_once('=')?;
        match key {
            "path" if path.is_none() => {
                let decoded = percent_decode_str(value).decode_utf8().ok()?;
                let decoded = decoded.into_owned();
                if !is_entry_path(&decoded) || security::decode(&format!("/{decoded}"))? != decoded
                {
                    return None;
                }
                path = Some(decoded);
            }
            "refresh" if refresh.is_none() && value == "1" => refresh = Some(true),
            _ => return None,
        }
    }
    Some((path?, refresh.unwrap_or(false)))
}
