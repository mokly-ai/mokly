//! Catalogue keys hash the exact sorted bytes sent by the transport.

use mkc_billing_interface::catalogue_provider::RunId;

use crate::client::form::{catalogue_idempotency_key, sorted_form};
use crate::transport::encode_form;

#[test]
fn fixed_form_body_has_a_fixed_catalogue_key() {
    let run = RunId::new("0123456789abcdef0123456789abcdef".to_owned()).unwrap();
    let form = sorted_form(vec![
        ("unit_amount".to_owned(), "2000".to_owned()),
        ("nickname".to_owned(), "Editor seat".to_owned()),
        ("product".to_owned(), "prod_team_fixture".to_owned()),
        ("tax_behavior".to_owned(), "exclusive".to_owned()),
        ("recurring[usage_type]".to_owned(), "licensed".to_owned()),
        (
            "lookup_key".to_owned(),
            "mokly_team_editor_usd_month".to_owned(),
        ),
        ("metadata[mokly_seat_kind]".to_owned(), "editor".to_owned()),
        ("currency".to_owned(), "usd".to_owned()),
        ("recurring[interval]".to_owned(), "month".to_owned()),
        ("transfer_lookup_key".to_owned(), "true".to_owned()),
    ]);
    let body = encode_form(&form);
    assert_eq!(
        body,
        "currency=usd&lookup_key=mokly_team_editor_usd_month&metadata%5Bmokly_seat_kind%5D=editor&nickname=Editor+seat&product=prod_team_fixture&recurring%5Binterval%5D=month&recurring%5Busage_type%5D=licensed&tax_behavior=exclusive&transfer_lookup_key=true&unit_amount=2000"
    );
    assert_eq!(
        catalogue_idempotency_key(
            &run,
            "price-create",
            "mokly_team_editor_usd_month",
            body.as_bytes()
        ),
        "mokly-catalogue:0123456789abcdef0123456789abcdef:price-create:mokly_team_editor_usd_month:561cc9dc5ca60c82a036e11d86d70e69"
    );
}
