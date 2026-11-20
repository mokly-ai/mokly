//! Catalogue router with exact CORS, request correlation and isolation headers.

use std::result;
use std::sync::Arc;

use axum::http::{HeaderValue, Method, header};
use axum::routing::get;
use axum::{Router, middleware};
use mkc_domain::client_origins::AdmittedOrigins;
use tower_http::cors::CorsLayer;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::set_header::SetResponseHeaderLayer;

use crate::error::{ErrorResultExt, Result};
use crate::http::Handler;
use crate::response;

pub(crate) trait RouterBuilder {
    fn build(&self) -> Result<Router>;
}

/// The CORS layer wraps the fallback handler, so it answers OPTIONS before the
/// handler resolves the host; preflight succeeds for unknown hosts too.
pub(crate) struct RouterFactory {
    pub(crate) handler: Arc<dyn Handler>,
    pub(crate) origins: AdmittedOrigins,
}

impl RouterBuilder for RouterFactory {
    fn build(&self) -> Result<Router> {
        let handler = self.handler.clone();
        let origins = self
            .origins
            .iter()
            .map(HeaderValue::from_str)
            .collect::<result::Result<Vec<_>, _>>()
            .context("configure catalogue CORS")?;
        let csp = HeaderValue::from_str(&response::csp(&self.origins))
            .context("configure catalogue CSP")?;
        Ok(Router::new()
            .route(
                "/_health",
                get(|| async { ([(header::CACHE_CONTROL, "no-store")], "ok") }),
            )
            .fallback(move |request| {
                let handler = handler.clone();
                async move { handler.handle(request).await }
            })
            .layer(
                CorsLayer::new()
                    .allow_origin(origins)
                    .allow_credentials(true)
                    .allow_methods([Method::GET, Method::HEAD, Method::POST])
                    .allow_headers([
                        header::CONTENT_TYPE,
                        header::HeaderName::from_static("x-request-id"),
                    ])
                    .expose_headers([header::HeaderName::from_static("x-request-id")]),
            )
            .layer(SetResponseHeaderLayer::overriding(
                header::VARY,
                HeaderValue::from_static("Origin, Cookie, Accept-Encoding"),
            ))
            .layer(middleware::from_fn(rpc_error::axum::log_errors))
            .layer(PropagateRequestIdLayer::x_request_id())
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
            .layer(SetResponseHeaderLayer::overriding(
                header::CONTENT_SECURITY_POLICY,
                csp,
            ))
            .layer(SetResponseHeaderLayer::overriding(
                header::X_CONTENT_TYPE_OPTIONS,
                HeaderValue::from_static("nosniff"),
            ))
            .layer(SetResponseHeaderLayer::overriding(
                header::REFERRER_POLICY,
                HeaderValue::from_static("no-referrer"),
            ))
            .layer(SetResponseHeaderLayer::overriding(
                header::HeaderName::from_static("permissions-policy"),
                HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=()"),
            )))
    }
}

#[cfg(test)]
#[path = "_tests_/router_tests.rs"]
mod tests;
