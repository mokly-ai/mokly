//! Exact Stripe price-list behavior for runtime catalogue resolution.

use serde_json::json;

use super::stripe_double::{
    COLLABORATOR_PRICE, COLLABORATOR_REPLACEMENT_PRICE, EDITOR_PRICE, EDITOR_REPLACEMENT_PRICE,
    PriceScenario, State,
};
use super::stripe_fixtures;
use super::stripe_routes::Recording;

pub(super) fn prices(form: &[(String, String)], state: &State) -> Recording {
    assert_eq!(
        form,
        [
            ("active".into(), "true".into()),
            ("lookup_keys[]".into(), "mokly_team_editor_usd_month".into()),
            (
                "lookup_keys[]".into(),
                "mokly_team_collaborator_usd_month".into(),
            ),
            ("expand[]".into(), "data.product".into()),
            ("limit".into(), "10".into()),
        ]
    );
    let mut body = stripe_fixtures::prices_by_lookup_key();
    match state.price_scenario {
        PriceScenario::Complete => {}
        PriceScenario::MissingEditor => {
            body["data"].as_array_mut().unwrap().remove(0);
        }
        PriceScenario::WrongEditorAmount => {
            body["data"][0]["unit_amount"] = json!(2_001);
        }
        PriceScenario::Replaced => {
            body["data"][0]["id"] = json!(EDITOR_REPLACEMENT_PRICE);
            body["data"][1]["id"] = json!(COLLABORATOR_REPLACEMENT_PRICE);
        }
    }
    Recording {
        status: 200,
        body,
        retry_after: None,
    }
}

pub(super) fn lookup_key(price: &str) -> Option<&'static str> {
    match price {
        EDITOR_PRICE | EDITOR_REPLACEMENT_PRICE => Some("mokly_team_editor_usd_month"),
        COLLABORATOR_PRICE | COLLABORATOR_REPLACEMENT_PRICE => {
            Some("mokly_team_collaborator_usd_month")
        }
        _ => None,
    }
}
