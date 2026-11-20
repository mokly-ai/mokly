//! Exact intended, action, and failure line rendering.

use std::io;

use mkc_billing_interface::error::{
    Error as ProviderError, ProviderDetail, ProviderErrorCode, ProviderErrorType,
};

use super::fixtures::catalogue;
use crate::stripe_catalogue::args::CatalogueEnvironment;
use crate::stripe_catalogue::report::{
    ErrorLine, ObjectAction, PriceAction, ProviderOperation, ProviderRefusal, ReportLine,
    intended_lines, provider_error,
};

#[test]
fn offline_check_lines_match_the_protocol_literals() {
    let lines = intended_lines(&catalogue())
        .into_iter()
        .map(|line| line.to_string())
        .collect::<Vec<_>>();
    assert_eq!(
        lines,
        [
            "product mokly_team intended name=\"Mokly Team\" active=true metadata.mokly_lookup_key=mokly_team",
            "price mokly_team_editor_usd_month intended product=mokly_team currency=usd unit_amount=2000 recurring.interval=month recurring.usage_type=licensed tax_behavior=exclusive nickname=\"Editor seat\" metadata.mokly_seat_kind=editor",
            "price mokly_team_collaborator_usd_month intended product=mokly_team currency=usd unit_amount=500 recurring.interval=month recurring.usage_type=licensed tax_behavior=exclusive nickname=\"Collaborator seat\" metadata.mokly_seat_kind=collaborator",
        ]
    );
}

#[test]
fn every_product_and_price_action_has_the_exact_grammar() {
    let object_cases = [
        (ObjectAction::WouldCreate, "would create"),
        (
            ObjectAction::WouldUpdate("prod_old".to_owned()),
            "would update prod_old",
        ),
        (
            ObjectAction::Created("prod_new".to_owned()),
            "created prod_new",
        ),
        (
            ObjectAction::Updated("prod_old".to_owned()),
            "updated prod_old",
        ),
        (
            ObjectAction::Validated("prod_old".to_owned()),
            "validated prod_old",
        ),
    ];
    for (action, suffix) in object_cases {
        assert_eq!(
            ReportLine::Product {
                key: "mokly_team".to_owned(),
                action,
            }
            .to_string(),
            format!("product mokly_team {suffix}")
        );
    }
    let price_cases = [
        (
            PriceAction::Object(ObjectAction::WouldCreate),
            "would create",
        ),
        (
            PriceAction::Object(ObjectAction::WouldUpdate("price_old".to_owned())),
            "would update price_old",
        ),
        (
            PriceAction::Object(ObjectAction::Created("price_new".to_owned())),
            "created price_new",
        ),
        (
            PriceAction::Object(ObjectAction::Updated("price_old".to_owned())),
            "updated price_old",
        ),
        (
            PriceAction::Object(ObjectAction::Validated("price_old".to_owned())),
            "validated price_old",
        ),
        (
            PriceAction::WouldReplace("price_old".to_owned()),
            "would replace price_old -> pending",
        ),
        (
            PriceAction::Replaced {
                old: "price_old".to_owned(),
                new: "price_new".to_owned(),
            },
            "replaced price_old -> price_new",
        ),
        (
            PriceAction::Current("price_new".to_owned()),
            "current price_new",
        ),
        (
            PriceAction::WouldArchive("price_old".to_owned()),
            "would archive price_old",
        ),
        (
            PriceAction::Archived("price_old".to_owned()),
            "archived price_old",
        ),
        (
            PriceAction::Kept {
                id: "price_old".to_owned(),
                until: "2026-09-28T14:05:09Z".to_owned(),
            },
            "kept price_old until 2026-09-28T14:05:09Z",
        ),
    ];
    for (action, suffix) in price_cases {
        assert_eq!(
            ReportLine::Price {
                key: "mokly_team_editor_usd_month".to_owned(),
                action,
            }
            .to_string(),
            format!("price mokly_team_editor_usd_month {suffix}")
        );
    }
}

#[test]
fn every_non_provider_failure_has_the_exact_line() {
    let cases = [
        (
            ErrorLine::MissingKey,
            "error missing-key variable=MKC_STRIPE_CATALOGUE_KEY",
        ),
        (
            ErrorLine::WrongKeyKind,
            "error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted",
        ),
        (
            ErrorLine::WrongKeyMode {
                environment: CatalogueEnvironment::Production,
            },
            "error wrong-key-mode environment=production expected=live",
        ),
        (
            ErrorLine::InvalidOrigin,
            "error invalid-origin variable=MKC_STRIPE_API_ORIGIN",
        ),
        (
            ErrorLine::DuplicateActiveProducts {
                lookup_key: "mokly_team".to_owned(),
                products: vec!["prod_a".to_owned(), "prod_b".to_owned()],
            },
            "error duplicate-active-products lookup_key=mokly_team products=prod_a,prod_b",
        ),
        (
            ErrorLine::MissingProduct {
                lookup_key: "mokly_team".to_owned(),
            },
            "error missing-product lookup_key=mokly_team",
        ),
        (
            ErrorLine::MissingCurrentPrice {
                lookup_key: "mokly_team_editor_usd_month".to_owned(),
            },
            "error missing-current-price lookup_key=mokly_team_editor_usd_month",
        ),
        (
            ErrorLine::InvalidCatalogueIdentity {
                field: "lookup-key",
            },
            "error invalid-catalogue-identity field=lookup-key",
        ),
    ];
    for (error, line) in cases {
        assert_eq!(error.to_string(), line);
    }
}

#[test]
fn every_provider_error_maps_to_its_exact_sanitized_line() {
    let refused = [
        (
            ProviderError::InvalidRequest {
                detail: ProviderDetail::none(),
            },
            "invalid-request",
        ),
        (
            ProviderError::Unauthorized {
                detail: ProviderDetail::none(),
            },
            "unauthorized",
        ),
        (
            ProviderError::NotFound {
                detail: ProviderDetail::none(),
            },
            "not-found",
        ),
        (
            ProviderError::RateLimited {
                retry_after: 9,
                detail: ProviderDetail::none(),
            },
            "rate-limited",
        ),
    ];
    for (error, reason) in refused {
        assert_eq!(
            provider_error(error, ProviderOperation::PriceUpdate, "price_old").to_string(),
            format!(
                "error provider-refused operation=price-update target=price_old reason={reason} type=none code=none"
            )
        );
    }
    assert_eq!(
        provider_error(
            ProviderError::PermissionDenied {
                detail: ProviderDetail::none(),
            },
            ProviderOperation::PriceUpdate,
            "price_old"
        )
        .to_string(),
        "error provider-refused operation=price-update target=price_old reason=permission-denied type=none code=none"
    );
    assert_eq!(
        provider_error(
            ProviderError::Unavailable,
            ProviderOperation::ListProductPrices,
            "prod_team"
        )
        .to_string(),
        "error provider-unavailable operation=list-product-prices target=prod_team"
    );
    assert_eq!(
        provider_error(
            ProviderError::internal(io::Error::other("secret body")),
            ProviderOperation::ListPrices,
            "catalogue"
        )
        .to_string(),
        "error provider-failed operation=list-prices target=catalogue"
    );
}

#[test]
fn provider_refusals_render_sanitized_type_and_code() {
    let detail = ProviderDetail {
        error_type: Some(ProviderErrorType::InvalidRequestError),
        code: ProviderErrorCode::new("permission_denied".to_owned()),
    };
    assert_eq!(
        provider_error(
            ProviderError::PermissionDenied { detail },
            ProviderOperation::PriceArchive,
            "price_old",
        )
        .to_string(),
        "error provider-refused operation=price-archive target=price_old reason=permission-denied type=invalid_request_error code=permission_denied"
    );
}

#[test]
fn provider_operation_and_refusal_vocabularies_cover_all_forms() {
    let operations = [
        ProviderOperation::ListProducts,
        ProviderOperation::ListPrices,
        ProviderOperation::ListProductPrices,
        ProviderOperation::RetrievePrice,
        ProviderOperation::ProductCreate,
        ProviderOperation::ProductUpdate,
        ProviderOperation::PriceCreate,
        ProviderOperation::PriceReplace,
        ProviderOperation::PriceUpdate,
        ProviderOperation::PriceArchive,
    ];
    for operation in operations {
        assert!(
            provider_error(ProviderError::Unavailable, operation, "target")
                .to_string()
                .starts_with("error provider-unavailable operation=")
        );
    }
    for reason in [
        ProviderRefusal::InvalidRequest,
        ProviderRefusal::Unauthorized,
        ProviderRefusal::PermissionDenied,
        ProviderRefusal::NotFound,
        ProviderRefusal::RateLimited,
    ] {
        assert!(!reason.to_string().is_empty());
    }
}
