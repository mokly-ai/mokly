//! Typed mutations of the recorded Stripe JSON fixtures.

use serde_json::{Value, json};

pub(super) type SubscriptionItemFixture<'a> =
    (&'a str, &'a str, Option<&'a str>, Option<&'a str>, i64);

pub(super) fn subscription(
    customer: &str,
    status: &str,
    cancel_at_period_end: bool,
    workspace: Option<&str>,
    items: &[SubscriptionItemFixture<'_>],
    period_end: i64,
) -> Value {
    let mut value = body("subscription");
    value["customer"] = json!(customer);
    value["status"] = json!(status);
    value["cancel_at_period_end"] = json!(cancel_at_period_end);
    value["metadata"]["organization_id"] = json!(workspace);
    value["items"]["data"] = Value::Array(
        items
            .iter()
            .map(|(id, price, lookup_key, seat_kind, quantity)| {
                let metadata =
                    seat_kind.map_or_else(|| json!({}), |kind| json!({"mokly_seat_kind": kind}));
                json!({
                    "id": id,
                    "object": "subscription_item",
                    "price": {
                        "id": price,
                        "lookup_key": lookup_key,
                        "metadata": metadata,
                        "object": "price"
                    },
                    "quantity": quantity,
                    "current_period_end": period_end
                })
            })
            .collect(),
    );
    value
}

pub(super) fn item(
    name: &str,
    id: &str,
    price: &str,
    lookup_key: Option<&str>,
    seat_kind: Option<&str>,
    quantity: i64,
) -> Value {
    let mut value = body(name);
    value["id"] = json!(id);
    value["price"]["id"] = json!(price);
    value["price"]["lookup_key"] = json!(lookup_key);
    value["price"]["metadata"] =
        seat_kind.map_or_else(|| json!({}), |kind| json!({"mokly_seat_kind": kind}));
    value["quantity"] = json!(quantity);
    value
}

pub(super) fn prices_by_lookup_key() -> Value {
    body("prices-by-lookup-key")
}

pub(super) fn body(name: &str) -> Value {
    let raw = match name {
        "customer" => include_str!("../../../mkc-billing-stripe/fixtures/customer.json"),
        "checkout-session" => {
            include_str!("../../../mkc-billing-stripe/fixtures/checkout-session.json")
        }
        "portal-session" => {
            include_str!("../../../mkc-billing-stripe/fixtures/portal-session.json")
        }
        "prices-by-lookup-key" => {
            include_str!("../../../mkc-billing-stripe/fixtures/prices-by-lookup-key.json")
        }
        "subscription" => include_str!("../../../mkc-billing-stripe/fixtures/subscription.json"),
        "canceled-subscription" => {
            include_str!("../../../mkc-billing-stripe/fixtures/canceled-subscription.json")
        }
        "subscription-item-created" => {
            include_str!("../../../mkc-billing-stripe/fixtures/subscription-item-created.json")
        }
        "subscription-item-updated" => {
            include_str!("../../../mkc-billing-stripe/fixtures/subscription-item-updated.json")
        }
        "deleted-item" => {
            include_str!("../../../mkc-billing-stripe/fixtures/deleted-item.json")
        }
        "rate-limited" => {
            include_str!("../../../mkc-billing-stripe/fixtures/rate-limited.json")
        }
        "unavailable" => include_str!("../../../mkc-billing-stripe/fixtures/unavailable.json"),
        _ => panic!("unknown Stripe fixture: {name}"),
    };
    serde_json::from_str::<Value>(raw).unwrap()["body"].clone()
}
