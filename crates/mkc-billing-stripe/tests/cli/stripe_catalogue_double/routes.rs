//! Exact Stripe endpoint, query, form, and idempotency contract for the double.

use std::collections::BTreeMap;

use mkc_domain::billing::{CATALOGUE, PRICE_SEAT_KIND_METADATA};
use serde_json::Value;
use url::form_urlencoded;

use super::StripeResponse;
use super::models::NewPrice;
use super::state::State;

const PRODUCTS_URL: &str = "/v1/products?limit=100";
const LOOKUP_PRICES_URL: &str = "/v1/prices?active=true&lookup_keys%5B%5D=mokly_team_editor_usd_month&lookup_keys%5B%5D=mokly_team_collaborator_usd_month&expand%5B%5D=data.product&limit=10";

pub(super) fn route(
    method: &str,
    url: &str,
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    match (method, url) {
        ("GET", PRODUCTS_URL) => empty_read(body, idempotency_key, state.products_body()),
        ("GET", LOOKUP_PRICES_URL) => {
            empty_read(body, idempotency_key, state.lookup_prices_body()?)
        }
        ("GET", _) if url.starts_with("/v1/prices?product=") => {
            empty_read(body, idempotency_key, product_prices(url, state)?)
        }
        ("GET", _) if url.starts_with("/v1/prices/") => {
            retrieve_price(url, body, idempotency_key, state)
        }
        ("POST", "/v1/products") => create_product(body, idempotency_key, state),
        ("POST", "/v1/prices") => create_price(body, idempotency_key, state),
        ("POST", _) if url.starts_with("/v1/products/") => {
            update_product(url, body, idempotency_key, state)
        }
        ("POST", _) if url.starts_with("/v1/prices/") => {
            update_price(url, body, idempotency_key, state)
        }
        _ => Err(format!("unexpected Stripe route {method} {url}")),
    }
}

fn empty_read(
    body: &str,
    idempotency_key: Option<&str>,
    response: Value,
) -> Result<StripeResponse, String> {
    if !body.is_empty() || idempotency_key.is_some() {
        return Err("GET request carried a body or idempotency key".to_owned());
    }
    Ok(StripeResponse::ok(response))
}

fn product_prices(url: &str, state: &State) -> Result<Value, String> {
    let prefix = "/v1/prices?product=";
    let Some(remainder) = url.strip_prefix(prefix) else {
        return Err("invalid product-price query".to_owned());
    };
    let Some((product, suffix)) = remainder.split_once('&') else {
        return Err("product-price query missing filters".to_owned());
    };
    if suffix != "active=true&limit=100" {
        return Err(format!("unexpected product-price query {url}"));
    }
    state.product_prices_body(product)
}

fn create_product(
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    require_key(
        idempotency_key,
        &format!("product-create:{}:", CATALOGUE.product.lookup_key),
    )?;
    let expected = vec![
        ("active", "true"),
        ("metadata[mokly_lookup_key]", CATALOGUE.product.lookup_key),
        ("name", CATALOGUE.product.name),
    ];
    require_form(body, &expected)?;
    Ok(StripeResponse::ok(
        state.create_product(CATALOGUE.product.name),
    ))
}

fn update_product(
    url: &str,
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    let id = path_id(url, "/v1/products/")?;
    require_key(idempotency_key, &format!("product-update:{id}:"))?;
    let expected = vec![
        ("active", "true"),
        ("metadata[mokly_lookup_key]", CATALOGUE.product.lookup_key),
        ("name", CATALOGUE.product.name),
    ];
    require_form(body, &expected)?;
    Ok(StripeResponse::ok(
        state.update_product(id, CATALOGUE.product.name)?,
    ))
}

fn create_price(
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    let form = parsed_form(body);
    let lookup_key = required(&form, "lookup_key")?;
    let Some(seat) = CATALOGUE
        .seats
        .iter()
        .find(|seat| seat.lookup_key == lookup_key)
    else {
        return Err(format!("unknown price lookup key {lookup_key}"));
    };
    let holder = state.lookup_holder(lookup_key);
    let prefix = match holder {
        Some(ref id) => format!("price-replace:{id}:"),
        None => format!("price-create:{lookup_key}:"),
    };
    require_key(idempotency_key, &prefix)?;
    let mut metadata =
        BTreeMap::from([("mokly_seat_kind".to_owned(), seat.kind.as_str().to_owned())]);
    if let Some(id) = &holder {
        metadata.insert("mokly_replaces".to_owned(), id.clone());
    }
    let mut expected = vec![
        ("currency", CATALOGUE.currency),
        ("lookup_key", seat.lookup_key),
    ];
    if let Some(id) = &holder {
        expected.push(("metadata[mokly_replaces]", id));
    }
    expected.extend([
        ("metadata[mokly_seat_kind]", seat.kind.as_str()),
        ("nickname", seat.nickname),
        ("product", required(&form, "product")?),
        ("recurring[interval]", CATALOGUE.interval),
        ("recurring[usage_type]", CATALOGUE.usage_type),
        ("tax_behavior", seat.tax_behavior.as_str()),
        ("transfer_lookup_key", "true"),
        ("unit_amount", required(&form, "unit_amount")?),
    ]);
    require_form(body, &expected)?;
    let unit_amount = required(&form, "unit_amount")?
        .parse::<i64>()
        .map_err(|_| "invalid unit amount".to_owned())?;
    if unit_amount != i64::from(seat.unit_amount_cents) {
        return Err(format!("unexpected unit amount {unit_amount}"));
    }
    Ok(StripeResponse::ok(state.create_price(NewPrice {
        product: required(&form, "product")?.to_owned(),
        unit_amount,
        currency: CATALOGUE.currency.to_owned(),
        interval: CATALOGUE.interval.to_owned(),
        usage_type: CATALOGUE.usage_type.to_owned(),
        lookup_key: seat.lookup_key.to_owned(),
        nickname: seat.nickname.to_owned(),
        tax_behavior: seat.tax_behavior.as_str().to_owned(),
        metadata,
    })?))
}

fn update_price(
    url: &str,
    body: &str,
    idempotency_key: Option<&str>,
    state: &mut State,
) -> Result<StripeResponse, String> {
    let id = path_id(url, "/v1/prices/")?;
    let form = parsed_form(body);
    if form.get("active").is_some_and(|value| value == "false") {
        require_key(idempotency_key, &format!("price-archive:{id}:"))?;
        require_form(body, &[("active", "false")])?;
        return Ok(StripeResponse::ok(state.archive_price(id)?));
    }
    require_key(idempotency_key, &format!("price-update:{id}:"))?;
    let seat_kind = required(&form, &format!("metadata[{PRICE_SEAT_KIND_METADATA}]"))?;
    let Some(seat) = CATALOGUE
        .seats
        .iter()
        .find(|seat| seat.kind.as_str() == seat_kind)
    else {
        return Err(format!("unknown seat kind {seat_kind}"));
    };
    require_form(
        body,
        &[
            ("metadata[mokly_seat_kind]", seat.kind.as_str()),
            ("nickname", seat.nickname),
        ],
    )?;
    Ok(StripeResponse::ok(state.update_price(
        id,
        seat.nickname,
        seat.kind.as_str(),
    )?))
}

fn retrieve_price(
    url: &str,
    body: &str,
    idempotency_key: Option<&str>,
    state: &State,
) -> Result<StripeResponse, String> {
    let id = path_id(url, "/v1/prices/")?;
    if !body.is_empty() || idempotency_key.is_some() {
        return Err("GET request carried a body or idempotency key".to_owned());
    }
    match state.price_body(id)? {
        Some(price) => Ok(StripeResponse::ok(price)),
        None => Ok(StripeResponse {
            status: 404,
            body: serde_json::json!({
                "error": {
                    "type": "invalid_request_error",
                    "code": "resource_missing",
                    "message": "fixture price missing"
                }
            }),
        }),
    }
}

fn parsed_form(body: &str) -> BTreeMap<String, String> {
    form_urlencoded::parse(body.as_bytes())
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect()
}

fn require_form(body: &str, expected: &[(&str, &str)]) -> Result<(), String> {
    let actual = form_urlencoded::parse(body.as_bytes())
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let expected = expected
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect::<Vec<_>>();
    if actual == expected {
        Ok(())
    } else {
        Err(format!("unexpected form {actual:?}, expected {expected:?}"))
    }
}

fn required<'a>(form: &'a BTreeMap<String, String>, key: &str) -> Result<&'a str, String> {
    form.get(key)
        .map(String::as_str)
        .ok_or_else(|| format!("missing form field {key}"))
}

fn path_id<'a>(url: &'a str, prefix: &str) -> Result<&'a str, String> {
    url.strip_prefix(prefix)
        .filter(|id| !id.is_empty() && !id.contains(['/', '?', '#']))
        .ok_or_else(|| format!("invalid write path {url}"))
}

fn require_key(key: Option<&str>, prefix: &str) -> Result<(), String> {
    let Some(scoped) = key.and_then(|key| key.strip_prefix("mokly-catalogue:")) else {
        return Err("idempotency key omitted the catalogue prefix".to_owned());
    };
    let Some((run, remainder)) = scoped.split_once(':') else {
        return Err("idempotency key omitted the run identifier".to_owned());
    };
    if run.len() != 32
        || !run
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err("idempotency run was not 32 lowercase hex characters".to_owned());
    }
    let Some(suffix) = remainder.strip_prefix(prefix) else {
        return Err(format!("idempotency key did not contain {prefix}"));
    };
    if suffix.len() == 32
        && suffix
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        Ok(())
    } else {
        Err("idempotency digest was not 32 lowercase hex characters".to_owned())
    }
}
