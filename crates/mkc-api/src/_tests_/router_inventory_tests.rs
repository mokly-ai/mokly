//! Every documented method and template reaches its typed operation handler.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::extract::ConnectInfo;
use axum::http::Request;
use axum::response::Response;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use crate::contract::response_capture::checked;
use crate::contract::route_fixture::routes;
use crate::dispatch::DispatchMock;
use crate::error::ApiError;
use crate::live::handler::LiveHandlerMock;
use crate::response;
use crate::router::RouterBuilder;
use crate::upload::UploadHandlerMock;

use super::contract_tests::factory;

#[tokio::test]
async fn every_documented_method_and_path_dispatches_its_operation() {
    for route in routes() {
        let operation = route.operation_id;
        let mut factory = factory();
        let (status, reason) = if operation.live() {
            factory.live = Arc::new(Unimock::new(
                LiveHandlerMock
                    .some_call(matching!(_, _))
                    .answers(&|_, params, _| {
                        assert_eq!(params["projectId"], "00000000-0000-7000-8000-000000000001");
                        Box::pin(async { response::failure(ApiError::ValidationFailed) })
                    }),
            ));
            (400, "validation-failed")
        } else if operation.upload() {
            factory.upload = Arc::new(Unimock::new(
                UploadHandlerMock
                    .next_call(matching!(_, _, _))
                    .answers_arc(Arc::new(move |_, actual, _, _| {
                        assert_eq!(actual, operation);
                        Box::pin(async { response::failure(ApiError::OperationUnavailable) })
                    })),
            ));
            (503, "operation-unavailable")
        } else {
            factory.dispatcher = Arc::new(Unimock::new(
                DispatchMock
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, request| {
                        assert_eq!(request.operation, operation);
                        Err(ApiError::OperationUnavailable)
                    })),
            ));
            (503, "operation-unavailable")
        };
        let response = checked(
            factory.build().unwrap(),
            request(&route.method, &route.path),
        )
        .await;
        assert_error(response, status, reason).await;
    }
}

#[tokio::test]
async fn undocumented_methods_and_paths_use_the_catalogued_fallbacks() {
    let router = factory().build().unwrap();
    let mut paths = BTreeMap::<_, Vec<_>>::new();
    for route in routes() {
        paths.entry(route.path).or_default().push(route.method);
    }
    for (path, methods) in paths {
        let method = ["PUT", "PATCH", "DELETE", "POST", "TRACE"]
            .into_iter()
            .find(|method| !methods.iter().any(|documented| documented == method))
            .unwrap();
        let response = checked(router.clone(), request(method, &path)).await;
        assert_error(response, 400, "method-not-allowed").await;
    }
    let response = checked(router, request("GET", "/v1/undocumented")).await;
    assert_error(response, 404, "not-found").await;
}

fn request(method: &str, template: &str) -> Request<Body> {
    let path = template
        .split('/')
        .map(|segment| {
            if segment.starts_with('{') {
                "00000000-0000-7000-8000-000000000001"
            } else {
                segment
            }
        })
        .collect::<Vec<_>>()
        .join("/");
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("x-request-id", "route-inventory")
        .header("x-github-delivery", "delivery")
        .header("x-github-event", "push")
        .header("x-hub-signature-256", "signature")
        .header("stripe-signature", "signature")
        .body(Body::empty())
        .unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
    request
}

async fn assert_error(response: Response, status: u16, reason: &str) {
    assert_eq!(response.status(), status);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["x-request-id"], "route-inventory");
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["error"]["reason"], reason);
    assert_eq!(body["error"]["request_id"], "route-inventory");
}
