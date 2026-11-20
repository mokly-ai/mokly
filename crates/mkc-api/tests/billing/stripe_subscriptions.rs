//! Subscription response construction for the recorded Stripe double.

use serde_json::{Value, json};

use super::stripe_double::State;
use super::stripe_fixtures;

const CUSTOMER: &str = "cus_fixture";
const PERIOD_END: i64 = 1_800_596_800;

pub(super) fn subscription_body(state: &State) -> Value {
    subscription_body_for(state, "sub_fixture")
}

pub(super) fn subscription_body_for(state: &State, subscription_id: &str) -> Value {
    let items: Vec<_> = state
        .items
        .iter()
        .map(|item| {
            (
                item.id.as_str(),
                item.price.as_str(),
                item.lookup_key.as_deref(),
                item.seat_kind.as_deref(),
                item.quantity,
            )
        })
        .collect();
    let mut body = stripe_fixtures::subscription(
        CUSTOMER,
        &state.status,
        state.cancel_at_period_end,
        state.workspace.as_deref(),
        &items,
        PERIOD_END,
    );
    body["id"] = json!(subscription_id);
    body["metadata"]["checkout_session_id"] = json!(state.checkout_session_id);
    if let Some(invoice) = &state.latest_invoice {
        body["latest_invoice"] = json!({
            "id": "in_fixture",
            "object": "invoice",
            "status": invoice.status,
            "attempted": invoice.attempted
        });
    }
    body
}
