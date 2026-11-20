//! Loopback Stripe API retaining requests and mutable subscription state.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mkc_billing_stripe::transport::STRIPE_VERSION;
use serde_json::Value;
use tiny_http::{Header, Response, Server, StatusCode};

use crate::test_server::ServerThread;

pub(super) const COLLABORATOR_PRICE: &str = "price_collaborator_fixture";
pub(super) const COLLABORATOR_REPLACEMENT_PRICE: &str = "price_collaborator_replacement_fixture";
pub(super) const EDITOR_PRICE: &str = "price_editor_fixture";
pub(super) const EDITOR_REPLACEMENT_PRICE: &str = "price_editor_replacement_fixture";
pub(super) const SECRET_KEY: &str = "sk_test_fixture";
pub(super) const WEBHOOK_SECRET: &str = "whsec_fixture_billing_secret";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) enum PriceScenario {
    #[default]
    Complete,
    MissingEditor,
    WrongEditorAmount,
    Replaced,
}

#[derive(Clone, Debug)]
pub(super) struct Call {
    pub(super) method: String,
    pub(super) path: String,
    pub(super) idempotency_key: Option<String>,
    pub(super) form: Vec<(String, String)>,
}

#[derive(Clone)]
pub(super) struct Item {
    pub(super) id: String,
    pub(super) price: String,
    pub(super) lookup_key: Option<String>,
    pub(super) seat_kind: Option<String>,
    pub(super) quantity: i64,
}

#[derive(Clone)]
pub(super) struct Invoice {
    pub(super) status: String,
    pub(super) attempted: bool,
}

pub(super) struct State {
    pub(super) workspace: Option<String>,
    pub(super) status: String,
    pub(super) cancel_at_period_end: bool,
    pub(super) items: Vec<Item>,
    pub(super) calls: Vec<Call>,
    pub(super) rate_limit_retrievals: usize,
    pub(super) fail_next_checkout: bool,
    pub(super) lose_next_checkout_response: bool,
    pub(super) lose_next_seat_response: bool,
    pub(super) lose_next_delete_response: bool,
    pub(super) checkout_sessions: usize,
    pub(super) checkout_session_id: Option<String>,
    pub(super) latest_invoice: Option<Invoice>,
    pub(super) price_scenario: PriceScenario,
    pub(super) idempotency_replays: HashMap<String, super::stripe_routes::Replay>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            workspace: None,
            status: "trialing".into(),
            cancel_at_period_end: false,
            items: Vec::new(),
            calls: Vec::new(),
            rate_limit_retrievals: 0,
            fail_next_checkout: false,
            lose_next_checkout_response: false,
            lose_next_seat_response: false,
            lose_next_delete_response: false,
            checkout_sessions: 0,
            checkout_session_id: None,
            latest_invoice: None,
            price_scenario: PriceScenario::Complete,
            idempotency_replays: HashMap::new(),
        }
    }
}

pub(super) struct RecordedStripe {
    /// Join the request thread before releasing its recorded state.
    _server: ServerThread,
    pub(super) origin: String,
    state: Arc<Mutex<State>>,
}

impl RecordedStripe {
    pub(super) fn start_with_price_scenario(price_scenario: PriceScenario) -> Self {
        let server = Arc::new(Server::http("127.0.0.1:0").unwrap());
        let origin = format!("http://{}", server.server_addr().to_ip().unwrap());
        let state = Arc::new(Mutex::new(State {
            price_scenario,
            ..State::default()
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let active_server = server.clone();
        let active_state = state.clone();
        let active_stop = stop.clone();
        let thread = ServerThread::spawn(
            "Stripe",
            move || {
                stop.store(true, Ordering::SeqCst);
                server.unblock();
            },
            move || {
                while !active_stop.load(Ordering::SeqCst) {
                    let Some(mut request) = active_server
                        .recv_timeout(Duration::from_millis(100))
                        .unwrap()
                    else {
                        continue;
                    };
                    let method = request.method().as_str().to_owned();
                    let url = request.url().to_owned();
                    verify_headers(&request);
                    let mut body = String::new();
                    request.as_reader().read_to_string(&mut body).unwrap();
                    let key = header(&request, "Idempotency-Key");
                    let recording = super::stripe_routes::route(
                        &method,
                        &url,
                        &body,
                        key,
                        &mut active_state.lock().unwrap(),
                    );
                    let mut response = Response::from_string(recording.body.to_string())
                        .with_status_code(StatusCode(recording.status));
                    response.add_header(
                        Header::from_bytes("Content-Type", "application/json").unwrap(),
                    );
                    if let Some(delay) = recording.retry_after {
                        response.add_header(Header::from_bytes("Retry-After", delay).unwrap());
                    }
                    request.respond(response).unwrap();
                }
            },
        );
        Self {
            _server: thread,
            origin,
            state,
        }
    }

    pub(super) fn set_subscription(&self, status: &str, cancel_at_period_end: bool) {
        let mut state = self.state.lock().unwrap();
        state.status = status.into();
        state.cancel_at_period_end = cancel_at_period_end;
    }

    pub(super) fn set_payment_failed(&self) {
        self.state.lock().unwrap().latest_invoice = Some(Invoice {
            status: "open".into(),
            attempted: true,
        });
    }

    pub(super) fn set_payment_paid(&self) {
        self.state.lock().unwrap().latest_invoice = Some(Invoice {
            status: "paid".into(),
            attempted: true,
        });
    }

    pub(super) fn fail_next_retrieval(&self) {
        self.state.lock().unwrap().rate_limit_retrievals += 1;
    }

    pub(super) fn fail_next_checkout(&self) {
        self.state.lock().unwrap().fail_next_checkout = true;
    }

    pub(super) fn lose_next_checkout_response(&self) {
        self.state.lock().unwrap().lose_next_checkout_response = true;
    }

    pub(super) fn lose_next_seat_response(&self) {
        self.state.lock().unwrap().lose_next_seat_response = true;
    }

    pub(super) fn lose_next_delete_response(&self) {
        self.state.lock().unwrap().lose_next_delete_response = true;
    }

    pub(super) fn replace_subscription_item_price(&self, item_id: &str, price: &str) {
        let mut state = self.state.lock().unwrap();
        let item = state
            .items
            .iter_mut()
            .find(|item| item.id == item_id)
            .unwrap();
        item.price = price.into();
        item.lookup_key = None;
    }

    pub(super) fn seed_historical_checkout(&self, workspace: &str) {
        let mut state = self.state.lock().unwrap();
        state.workspace = Some(workspace.to_owned());
        state.status = "active".into();
        state.items = vec![
            Item {
                id: "si_editor_fixture".into(),
                price: EDITOR_PRICE.into(),
                lookup_key: None,
                seat_kind: Some("editor".into()),
                quantity: 1,
            },
            Item {
                id: "si_collaborator_fixture".into(),
                price: COLLABORATOR_PRICE.into(),
                lookup_key: None,
                seat_kind: Some("collaborator".into()),
                quantity: 2,
            },
        ];
    }

    pub(super) fn subscription_object(&self) -> Value {
        super::stripe_subscriptions::subscription_body(&self.state.lock().unwrap())
    }

    pub(super) fn calls(&self) -> Vec<Call> {
        self.state.lock().unwrap().calls.clone()
    }
}

fn verify_headers(request: &tiny_http::Request) {
    assert_eq!(
        header(request, "Authorization").as_deref(),
        Some("Bearer sk_test_fixture")
    );
    assert_eq!(
        header(request, "Stripe-Version").as_deref(),
        Some(STRIPE_VERSION)
    );
    assert!(
        header(request, "User-Agent")
            .unwrap()
            .starts_with("Mokly-Cloud-Billing")
    );
}

fn header(request: &tiny_http::Request, name: &'static str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|header| header.field.equiv(name))
        .map(|header| header.value.as_str().to_owned())
}
