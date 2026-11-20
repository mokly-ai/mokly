//! Stripe endpoint behavior backed by the recording's mutable state.

use serde_json::{Value, json};
use url::form_urlencoded;

use super::stripe_double::{Call, EDITOR_PRICE, EDITOR_REPLACEMENT_PRICE, Item, State};
use super::stripe_fixtures;
use super::stripe_prices::{lookup_key, prices};
use super::stripe_subscriptions::subscription_body_for;

#[derive(Clone)]
pub(super) struct Recording {
    pub(super) status: u16,
    pub(super) body: Value,
    pub(super) retry_after: Option<&'static str>,
}

#[derive(Clone)]
pub(super) struct Replay {
    method: String,
    path: String,
    form: Vec<(String, String)>,
    recording: Recording,
}

pub(super) fn route(
    method: &str,
    url: &str,
    body: &str,
    key: Option<String>,
    state: &mut State,
) -> Recording {
    let (path, query) = url.split_once('?').unwrap_or((url, ""));
    let encoded = if method == "GET" { query } else { body };
    let form: Vec<_> = form_urlencoded::parse(encoded.as_bytes())
        .into_owned()
        .collect();
    state.calls.push(Call {
        method: method.into(),
        path: path.into(),
        idempotency_key: key.clone(),
        form: form.clone(),
    });
    if path == "/v1/checkout/sessions" && state.fail_next_checkout {
        state.fail_next_checkout = false;
        return Recording {
            status: 500,
            body: stripe_fixtures::body("unavailable"),
            retry_after: None,
        };
    }
    let keyed_write = method != "GET" && key.is_some();
    if keyed_write
        && let Some(key) = &key
        && let Some(replay) = state.idempotency_replays.get(key)
    {
        if replay.method != method || replay.path != path || replay.form != form {
            return Recording {
                status: 400,
                body: json!({"error":{"type":"idempotency_error"}}),
                retry_after: None,
            };
        }
        return replay.recording.clone();
    }
    let lose_response = if method == "DELETE"
        && path.starts_with("/v1/subscription_items/")
        && state.lose_next_delete_response
    {
        state.lose_next_delete_response = false;
        true
    } else if path == "/v1/checkout/sessions" && state.lose_next_checkout_response {
        state.lose_next_checkout_response = false;
        true
    } else if path.starts_with("/v1/subscription_items") && state.lose_next_seat_response {
        state.lose_next_seat_response = false;
        true
    } else {
        false
    };
    let recording = match (method, path) {
        ("GET", "/v1/prices") => prices(&form, state),
        ("POST", "/v1/customers") => create_customer(&form, state),
        ("POST", "/v1/checkout/sessions") => checkout(&form, state),
        ("POST", "/v1/billing_portal/sessions") => fixture("portal-session"),
        ("GET", path) if path.starts_with("/v1/subscriptions/") => {
            retrieve_subscription(path, state)
        }
        ("DELETE", "/v1/subscriptions/sub_fixture") => cancel_subscription(state),
        ("POST", "/v1/subscription_items") => create_item(&form, state),
        ("POST", path) if path.starts_with("/v1/subscription_items/") => {
            update_item(path, &form, state)
        }
        ("DELETE", path) if path.starts_with("/v1/subscription_items/") => delete_item(path, state),
        _ => panic!("unrecorded Stripe request: {method} {url}"),
    };
    if keyed_write && let Some(key) = key {
        state.idempotency_replays.insert(
            key,
            Replay {
                method: method.into(),
                path: path.into(),
                form,
                recording: recording.clone(),
            },
        );
    }
    if lose_response {
        return Recording {
            status: 500,
            body: stripe_fixtures::body("unavailable"),
            retry_after: None,
        };
    }
    recording
}

fn create_customer(form: &[(String, String)], state: &mut State) -> Recording {
    state.workspace = value(form, "metadata[organization_id]").map(str::to_owned);
    let mut body = stripe_fixtures::body("customer");
    body["metadata"]["organization_id"] = json!(state.workspace);
    success(body)
}

fn checkout(form: &[(String, String)], state: &mut State) -> Recording {
    state.workspace = value(form, "client_reference_id").map(str::to_owned);
    state.checkout_session_id =
        value(form, "subscription_data[metadata][checkout_session_id]").map(str::to_owned);
    state.status = "trialing".into();
    state.cancel_at_period_end = false;
    state.latest_invoice = None;
    state.items.clear();
    for index in 0..2 {
        let price = value(form, &format!("line_items[{index}][price]"));
        let quantity = value(form, &format!("line_items[{index}][quantity]"));
        if let (Some(price), Some(quantity)) = (price, quantity) {
            state.items.push(Item {
                id: if price == EDITOR_PRICE {
                    "si_editor_fixture"
                } else {
                    "si_collaborator_fixture"
                }
                .into(),
                price: price.into(),
                lookup_key: lookup_key(price).map(str::to_owned),
                seat_kind: seat_kind(price).map(str::to_owned),
                quantity: quantity.parse().unwrap(),
            });
        }
    }
    state.checkout_sessions += 1;
    let mut recording = fixture("checkout-session");
    if state.checkout_sessions > 1 {
        let id = format!("cs_test_fixture_{}", state.checkout_sessions);
        recording.body["id"] = json!(id);
        recording.body["url"] = json!(format!("https://checkout.stripe.test/c/pay/{id}"));
    }
    recording
}

fn retrieve_subscription(path: &str, state: &mut State) -> Recording {
    if state.rate_limit_retrievals > 0 {
        state.rate_limit_retrievals -= 1;
        return Recording {
            status: 429,
            body: stripe_fixtures::body("rate-limited"),
            retry_after: Some("2"),
        };
    }
    success(subscription_body_for(
        state,
        path.trim_start_matches("/v1/subscriptions/"),
    ))
}

fn cancel_subscription(state: &mut State) -> Recording {
    state.status = "canceled".into();
    let mut body = stripe_fixtures::body("canceled-subscription");
    body["metadata"]["organization_id"] = json!(state.workspace);
    success(body)
}

fn create_item(form: &[(String, String)], state: &mut State) -> Recording {
    let price = value(form, "price").unwrap();
    let quantity = value(form, "quantity").unwrap().parse().unwrap();
    let id = if price == EDITOR_PRICE {
        "si_editor_fixture"
    } else {
        "si_collaborator_fixture"
    };
    state.items.retain(|item| item.price != price);
    state.items.push(Item {
        id: id.into(),
        price: price.into(),
        lookup_key: lookup_key(price).map(str::to_owned),
        seat_kind: seat_kind(price).map(str::to_owned),
        quantity,
    });
    success(stripe_fixtures::item(
        "subscription-item-created",
        id,
        price,
        lookup_key(price),
        seat_kind(price),
        quantity,
    ))
}

fn update_item(path: &str, form: &[(String, String)], state: &mut State) -> Recording {
    let id = path.trim_start_matches("/v1/subscription_items/");
    let quantity = value(form, "quantity").unwrap().parse().unwrap();
    let item = state.items.iter_mut().find(|item| item.id == id).unwrap();
    item.quantity = quantity;
    success(stripe_fixtures::item(
        "subscription-item-updated",
        id,
        &item.price,
        item.lookup_key.as_deref(),
        item.seat_kind.as_deref(),
        quantity,
    ))
}

fn delete_item(path: &str, state: &mut State) -> Recording {
    let id = path.trim_start_matches("/v1/subscription_items/");
    if !state.items.iter().any(|item| item.id == id) {
        return Recording {
            status: 404,
            body: json!({"error":{"type":"invalid_request_error"}}),
            retry_after: None,
        };
    }
    state.items.retain(|item| item.id != id);
    let mut body = stripe_fixtures::body("deleted-item");
    body["id"] = json!(id);
    success(body)
}

fn fixture(name: &str) -> Recording {
    success(stripe_fixtures::body(name))
}

fn success(body: Value) -> Recording {
    Recording {
        status: 200,
        body,
        retry_after: None,
    }
}

fn value<'a>(form: &'a [(String, String)], name: &str) -> Option<&'a str> {
    form.iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}

fn seat_kind(price: &str) -> Option<&'static str> {
    match price {
        EDITOR_PRICE | EDITOR_REPLACEMENT_PRICE => Some("editor"),
        _ if lookup_key(price).is_some() => Some("collaborator"),
        _ => None,
    }
}
