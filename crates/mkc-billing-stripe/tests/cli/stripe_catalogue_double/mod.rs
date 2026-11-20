//! Stateful loopback Stripe double for the `stripe-catalogue` CLI.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use mkc_billing_stripe::transport::STRIPE_VERSION;
use serde_json::{Value, json};
use tiny_http::{Header, Response, Server, StatusCode};

mod models;
mod price_state;
mod routes;
mod state;

pub(super) use state::Call;
use state::State;

pub(super) const CATALOGUE_KEY: &str = "rk_test_fixture_catalogue";

#[derive(Clone)]
pub(super) struct StripeResponse {
    pub(super) status: u16,
    pub(super) body: Value,
}

impl StripeResponse {
    pub(super) fn ok(body: Value) -> Self {
        Self { status: 200, body }
    }
}

pub(super) struct StripeDouble {
    origin: String,
    state: Arc<Mutex<State>>,
    stop: Arc<AtomicBool>,
    server: Arc<Server>,
    thread: Option<JoinHandle<()>>,
}

impl StripeDouble {
    pub(super) fn start() -> Self {
        let server = Arc::new(Server::http("127.0.0.1:0").unwrap());
        let origin = format!("http://{}", server.server_addr().to_ip().unwrap());
        let state = Arc::new(Mutex::new(State::default()));
        let stop = Arc::new(AtomicBool::new(false));
        let active_server = server.clone();
        let active_state = state.clone();
        let active_stop = stop.clone();
        let thread = thread::spawn(move || {
            while !active_stop.load(Ordering::SeqCst) {
                let Some(mut request) = active_server
                    .recv_timeout(Duration::from_millis(100))
                    .unwrap()
                else {
                    continue;
                };
                let method = request.method().as_str().to_owned();
                let url = request.url().to_owned();
                let idempotency_key = header(&request, "Idempotency-Key");
                let mut body = String::new();
                let read = request
                    .as_reader()
                    .read_to_string(&mut body)
                    .map_err(|error| format!("read request body: {error}"));
                let mut state = active_state.lock().unwrap();
                state.calls.push(Call {
                    method: method.clone(),
                    url: url.clone(),
                    idempotency_key: idempotency_key.clone(),
                    body: body.clone(),
                });
                let result = read.and_then(|_| verify_headers(&request)).and_then(|_| {
                    if method == "POST" {
                        write_response(&method, &url, &body, idempotency_key.as_deref(), &mut state)
                    } else {
                        routes::route(&method, &url, &body, idempotency_key.as_deref(), &mut state)
                    }
                });
                let response = match result {
                    Ok(response) => response,
                    Err(error) => {
                        state.failures.push(error);
                        StripeResponse {
                            status: 500,
                            body: json!({"error": {"message": "recorded double rejected request"}}),
                        }
                    }
                };
                let mut http_response = Response::from_string(response.body.to_string())
                    .with_status_code(StatusCode(response.status));
                http_response
                    .add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                request.respond(http_response).unwrap();
            }
        });
        Self {
            origin,
            state,
            stop,
            server,
            thread: Some(thread),
        }
    }

    pub(super) fn origin(&self) -> &str {
        &self.origin
    }

    pub(super) fn seed_catalogue(&self, editor_id: &str, editor_amount: i64) {
        self.state
            .lock()
            .unwrap()
            .seed_catalogue(editor_id, editor_amount);
    }

    pub(super) fn seed_catalogue_without_editor_tag(&self, editor_id: &str, editor_amount: i64) {
        self.state
            .lock()
            .unwrap()
            .seed_catalogue_without_editor_tag(editor_id, editor_amount);
    }

    pub(super) fn seed_keyless_editor(&self, id: &str) {
        self.state.lock().unwrap().seed_keyless_editor(id);
    }

    pub(super) fn seed_product_only(&self) {
        self.state.lock().unwrap().seed_product_only();
    }

    pub(super) fn seed_cross_product_chain(&self) {
        self.state.lock().unwrap().seed_cross_product_chain();
    }

    pub(super) fn set_price_created(&self, id: &str, created: i64) {
        self.state.lock().unwrap().set_price_created(id, created);
    }

    pub(super) fn set_next_price_created(&self, created: i64) {
        self.state.lock().unwrap().set_next_price_created(created);
    }

    pub(super) fn archive_product(&self) {
        self.state.lock().unwrap().archive_product();
    }

    pub(super) fn queue_server_error(&self) {
        self.state.lock().unwrap().queue_write_response(StripeResponse {
            status: 500,
            body: json!({"error": {"type": "api_error", "code": "server_error", "message": "fixture outage"}}),
        });
    }

    pub(super) fn queue_permission_denied(&self) {
        self.state.lock().unwrap().queue_write_response(StripeResponse {
            status: 403,
            body: json!({"error": {"type": "invalid_request_error", "code": "permission_denied", "message": "fixture denial"}}),
        });
    }

    pub(super) fn price_active(&self, id: &str) -> bool {
        self.state.lock().unwrap().price_active(id)
    }

    pub(super) fn price(&self, id: &str) -> Value {
        self.state.lock().unwrap().price_body(id).unwrap().unwrap()
    }

    pub(super) fn product_active(&self) -> bool {
        self.state.lock().unwrap().product_active()
    }

    pub(super) fn request_count(&self) -> usize {
        self.state.lock().unwrap().calls.len()
    }

    pub(super) fn write_count(&self) -> usize {
        self.state
            .lock()
            .unwrap()
            .calls
            .iter()
            .filter(|call| call.method == "POST")
            .count()
    }

    pub(super) fn calls(&self) -> Vec<Call> {
        self.state.lock().unwrap().calls.clone()
    }

    pub(super) fn assert_clean(mut self) {
        self.stop_thread();
        let failures = &self.state.lock().unwrap().failures;
        assert!(failures.is_empty(), "double failures: {failures:?}");
    }

    fn stop_thread(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        self.server.unblock();
        if let Some(thread) = self.thread.take() {
            thread.join().unwrap();
        }
    }
}

fn write_response(
    method: &str,
    url: &str,
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    let Some(key) = idempotency_key else {
        return Err("POST request omitted Idempotency-Key".to_owned());
    };
    if let Some(response) = state.replay(key) {
        return Ok(response);
    }
    let response = match state.take_queued_write_response() {
        Some(response) => response,
        None => routes::route(method, url, body, Some(key), state)?,
    };
    state.remember(key, response.clone());
    Ok(response)
}

impl Drop for StripeDouble {
    fn drop(&mut self) {
        self.stop_thread();
    }
}

fn verify_headers(request: &tiny_http::Request) -> Result<(), String> {
    if header(request, "Authorization").as_deref() != Some("Bearer rk_test_fixture_catalogue") {
        return Err("authorization header did not contain the fixture key".to_owned());
    }
    if header(request, "Stripe-Version").as_deref() != Some(STRIPE_VERSION) {
        return Err("Stripe-Version did not match the pinned version".to_owned());
    }
    if request.method().as_str() == "POST" && header(request, "Idempotency-Key").is_none() {
        return Err("POST request omitted Idempotency-Key".to_owned());
    }
    Ok(())
}

fn header(request: &tiny_http::Request, name: &'static str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|header| header.field.equiv(name))
        .map(|header| header.value.as_str().to_owned())
}
