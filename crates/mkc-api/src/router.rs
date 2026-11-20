//! Document-driven Axum routing with bounded bodies and typed rejections.

use std::collections::HashMap;
use std::error::Error;
use std::net::SocketAddr;
use std::result;
use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{ConnectInfo, Path, Request};
use axum::http::{HeaderValue, Method, header};
use axum::middleware::Next;
use axum::routing::on;
use axum::{Router, middleware};
use http_body_util::LengthLimitError;
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::AdmittedOrigins;
use tower_http::cors::CorsLayer;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::set_header::SetResponseHeaderLayer;
use utoipa::{OpenApi, openapi};

use crate::contract::document::ApiDoc;
use crate::dispatch::{self, Dispatcher, WebhookHeaders};
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::operation::Operation;
use crate::response;
use crate::route_contract::routes;
use crate::upload::UploadHandler;

pub(crate) struct RouterFactory {
    pub(crate) trusted_proxies: TrustedProxies,
    pub(crate) dispatcher: Arc<dyn Dispatcher>,
    pub(crate) upload: Arc<dyn UploadHandler>,
    pub(crate) origins: AdmittedOrigins,
    pub(crate) billing_configured: bool,
}

pub(crate) trait RouterBuilder {
    fn build(&self) -> Result<Router>;
}

impl RouterBuilder for RouterFactory {
    fn build(&self) -> Result<Router> {
        self.build_document(&ApiDoc::openapi())
    }
}

impl RouterFactory {
    fn build_document(&self, document: &openapi::OpenApi) -> Result<Router> {
        let mut router = Router::new();
        for route in routes(document)? {
            let dispatcher = self.dispatcher.clone();
            let upload = self.upload.clone();
            let proxies = self.trusted_proxies.clone();
            let billing_configured = self.billing_configured;
            router = router.route(
                &route.path,
                on(
                    route.filter,
                    move |params: result::Result<
                        Path<HashMap<String, String>>,
                        axum::extract::rejection::PathRejection,
                    >,
                          ConnectInfo(peer): ConnectInfo<SocketAddr>,
                          request: Request| {
                        let dispatcher = dispatcher.clone();
                        let upload = upload.clone();
                        let proxies = proxies.clone();
                        async move {
                            let params = match params {
                                Ok(Path(params)) => params,
                                Err(_) => return response::failure(ApiError::ValidationFailed),
                            };
                            if route.operation_id.upload() {
                                return upload.handle(route.operation_id, params, request).await;
                            }
                            let (parts, body) = request.into_parts();
                            let forwarded =
                                if parts.headers.get_all("x-forwarded-for").iter().count() == 1 {
                                    parts
                                        .headers
                                        .get("x-forwarded-for")
                                        .and_then(|value| value.to_str().ok())
                                } else {
                                    None
                                };
                            let client_ip = proxies.client_ip(peer.ip(), forwarded);
                            let field = |key: &str| {
                                parts
                                    .headers
                                    .get(key)
                                    .and_then(|value| value.to_str().ok())
                                    .map(str::to_owned)
                            };
                            let cookie = field("cookie").and_then(|cookies| {
                                cookies.split(';').find_map(|cookie| {
                                    cookie
                                        .trim()
                                        .strip_prefix("mkc_session=")
                                        .map(str::to_owned)
                                })
                            });
                            if route.operation_id != Operation::ReceiveBillingWebhook
                                || billing_configured
                            {
                                for name in route.operation_id.required_single_headers() {
                                    if parts.headers.get_all(*name).iter().count() != 1 {
                                        return response::failure(ApiError::ValidationFailed);
                                    }
                                }
                            }
                            let limit = route.operation_id.body_limit();
                            let bytes = match to_bytes(body, limit).await {
                                Ok(bytes) => bytes,
                                Err(error) => return response::failure(body_error(error)),
                            };
                            if !bytes.is_empty()
                                && !field("content-type").is_some_and(|s| {
                                    s.split(';')
                                        .next()
                                        .is_some_and(|s| s.trim() == "application/json")
                                })
                            {
                                return response::failure(ApiError::ValidationFailed);
                            }
                            let webhook = if route.operation_id == Operation::ReceiveGitHubWebhook {
                                let one = |name: &str| {
                                    (parts.headers.get_all(name).iter().count() == 1)
                                        .then(|| field(name))
                                        .flatten()
                                };
                                match (
                                    one("x-github-delivery"),
                                    one("x-github-event"),
                                    one("x-hub-signature-256"),
                                ) {
                                    (Some(delivery_id), Some(event), Some(signature)) => {
                                        Some(WebhookHeaders {
                                            delivery_id,
                                            event,
                                            signature,
                                        })
                                    }
                                    _ => None,
                                }
                            } else {
                                None
                            };
                            let request = dispatch::Request {
                                operation: route.operation_id,
                                params,
                                body: bytes.to_vec(),
                                credential: cookie,
                                csrf: field("x-csrf-token"),
                                origin: field("origin"),
                                peer: client_ip.to_string(),
                                query: parts.uri.query().unwrap_or_default().to_owned(),
                                mutating: parts.method != Method::GET,
                                webhook,
                                billing_signature: if route.operation_id
                                    == Operation::ReceiveBillingWebhook
                                {
                                    field("stripe-signature")
                                } else {
                                    None
                                },
                            };
                            let result =
                                tokio::task::spawn_blocking(move || dispatcher.dispatch(request))
                                    .await
                                    .context("dispatch API request")
                                    .and_then(|result| result);
                            response::render(result)
                        }
                    },
                ),
            );
        }
        router = router.fallback(|| async { response::failure(ApiError::NotFound) });
        router = router.method_not_allowed_fallback(|| async {
            response::failure(ApiError::MethodNotAllowed)
        });
        let origins = self
            .origins
            .iter()
            .map(HeaderValue::from_str)
            .collect::<result::Result<Vec<_>, _>>()
            .context("configure client origins")?;
        Ok(router
            .layer(
                CorsLayer::new()
                    .allow_origin(origins)
                    .allow_credentials(true)
                    .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
                    .allow_headers([
                        header::CONTENT_TYPE,
                        header::HeaderName::from_static("x-csrf-token"),
                        header::HeaderName::from_static("x-request-id"),
                    ])
                    .expose_headers([
                        header::HeaderName::from_static("x-request-id"),
                        header::RETRY_AFTER,
                    ]),
            )
            .layer(middleware::from_fn(rpc_error::axum::log_errors))
            .layer(PropagateRequestIdLayer::x_request_id())
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
            .layer(middleware::from_fn(
                |mut request: Request, next: Next| async move {
                    if request
                        .headers()
                        .get("x-request-id")
                        .is_some_and(|value| value.to_str().ok().is_none_or(str::is_empty))
                    {
                        request.headers_mut().remove("x-request-id");
                    }
                    next.run(request).await
                },
            ))
            .layer(SetResponseHeaderLayer::overriding(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-store"),
            )))
    }
}

fn body_error(error: axum::Error) -> ApiError {
    if error
        .source()
        .is_some_and(|source| source.is::<LengthLimitError>())
    {
        ApiError::PayloadTooLarge
    } else {
        ApiError::ValidationFailed
    }
}

#[cfg(test)]
#[path = "_tests_/router_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "_tests_/proxy_tests.rs"]
mod proxy_tests;

#[cfg(test)]
#[path = "_tests_/return_to_tests.rs"]
mod return_to_tests;

#[cfg(test)]
#[path = "_tests_/cors_tests.rs"]
mod cors_tests;

#[cfg(test)]
#[path = "_tests_/router_contract_tests.rs"]
mod contract_tests;

#[cfg(test)]
#[path = "_tests_/router_inventory_tests.rs"]
mod inventory_tests;
