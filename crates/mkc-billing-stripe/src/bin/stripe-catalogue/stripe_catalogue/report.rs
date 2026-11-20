//! Exact stdout report and stderr failure-line rendering.

use std::fmt;

use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_domain::billing::Catalogue;
use thiserror::Error;

use super::args::CatalogueEnvironment;

/// One successful or intended catalogue report line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ReportLine {
    /// Complete intended product state from the offline check.
    IntendedProduct { key: String, name: String },
    /// Complete intended price state from the offline check.
    IntendedPrice {
        key: String,
        product: String,
        currency: String,
        unit_amount: i64,
        interval: String,
        usage_type: String,
        tax_behavior: String,
        nickname: String,
        seat_kind: String,
    },
    /// Product reconciliation outcome.
    Product { key: String, action: ObjectAction },
    /// Price reconciliation outcome.
    Price { key: String, action: PriceAction },
}

/// Create, edit, or validation result shared by products and prices.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ObjectAction {
    WouldCreate,
    WouldUpdate(String),
    Created(String),
    Updated(String),
    Validated(String),
}

/// Price-specific result including replacement and post-rollout archival.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PriceAction {
    Object(ObjectAction),
    WouldReplace(String),
    Replaced { old: String, new: String },
    Current(String),
    WouldArchive(String),
    Archived(String),
    Kept { id: String, until: String },
}

/// Provider operation vocabulary used by exact failures.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ProviderOperation {
    ListProducts,
    ListPrices,
    ListProductPrices,
    RetrievePrice,
    ProductCreate,
    ProductUpdate,
    PriceCreate,
    PriceReplace,
    PriceUpdate,
    PriceArchive,
}

impl ProviderOperation {
    fn as_str(self) -> &'static str {
        match self {
            Self::ListProducts => "list-products",
            Self::ListPrices => "list-prices",
            Self::ListProductPrices => "list-product-prices",
            Self::RetrievePrice => "retrieve-price",
            Self::ProductCreate => "product-create",
            Self::ProductUpdate => "product-update",
            Self::PriceCreate => "price-create",
            Self::PriceReplace => "price-replace",
            Self::PriceUpdate => "price-update",
            Self::PriceArchive => "price-archive",
        }
    }
}

/// Exact catalogue command failure line.
#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum ErrorLine {
    #[error("error missing-key variable=MKC_STRIPE_CATALOGUE_KEY")]
    MissingKey,
    #[error("error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted")]
    WrongKeyKind,
    #[error(
        "error wrong-key-mode environment={} expected={}",
        .environment.as_str(),
        .environment.key_mode()
    )]
    WrongKeyMode { environment: CatalogueEnvironment },
    #[error("error invalid-origin variable=MKC_STRIPE_API_ORIGIN")]
    InvalidOrigin,
    #[error(
        "error duplicate-active-products lookup_key={lookup_key} products={}",
        .products.join(",")
    )]
    DuplicateActiveProducts {
        lookup_key: String,
        products: Vec<String>,
    },
    #[error("error missing-product lookup_key={lookup_key}")]
    MissingProduct { lookup_key: String },
    #[error("error missing-current-price lookup_key={lookup_key}")]
    MissingCurrentPrice { lookup_key: String },
    #[error(
        "error provider-refused operation={} target={target} reason={reason} {detail}",
        .operation.as_str()
    )]
    ProviderRefused {
        operation: ProviderOperation,
        target: String,
        reason: ProviderRefusal,
        detail: ProviderDetail,
    },
    #[error("error provider-unavailable operation={} target={target}", .operation.as_str())]
    ProviderUnavailable {
        operation: ProviderOperation,
        target: String,
    },
    #[error("error provider-failed operation={} target={target}", .operation.as_str())]
    ProviderFailed {
        operation: ProviderOperation,
        target: String,
    },
    #[error("error invalid-catalogue-identity field={field}")]
    InvalidCatalogueIdentity { field: &'static str },
}

/// Stable refusal reason exposed without provider response details.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ProviderRefusal {
    InvalidRequest,
    Unauthorized,
    PermissionDenied,
    NotFound,
    RateLimited,
}

impl fmt::Display for ProviderRefusal {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::InvalidRequest => "invalid-request",
            Self::Unauthorized => "unauthorized",
            Self::PermissionDenied => "permission-denied",
            Self::NotFound => "not-found",
            Self::RateLimited => "rate-limited",
        };
        formatter.write_str(value)
    }
}

/// Build the offline intended-state lines in identity-table order.
pub(crate) fn intended_lines(catalogue: &Catalogue) -> Vec<ReportLine> {
    let mut lines = vec![ReportLine::IntendedProduct {
        key: catalogue.product.lookup_key.to_owned(),
        name: catalogue.product.name.to_owned(),
    }];
    lines.extend(
        catalogue
            .seats
            .iter()
            .map(|seat| ReportLine::IntendedPrice {
                key: seat.lookup_key.to_owned(),
                product: catalogue.product.lookup_key.to_owned(),
                currency: catalogue.currency.to_owned(),
                unit_amount: i64::from(seat.unit_amount_cents),
                interval: catalogue.interval.to_owned(),
                usage_type: catalogue.usage_type.to_owned(),
                tax_behavior: seat.tax_behavior.as_str().to_owned(),
                nickname: seat.nickname.to_owned(),
                seat_kind: seat.kind.as_str().to_owned(),
            }),
    );
    lines
}

/// Remove provider details while preserving its actionable class.
pub(crate) fn provider_error(
    error: ProviderError,
    operation: ProviderOperation,
    target: &str,
) -> ErrorLine {
    let target = target.to_owned();
    match error {
        ProviderError::InvalidRequest { detail } => {
            refused(operation, target, ProviderRefusal::InvalidRequest, detail)
        }
        ProviderError::Unauthorized { detail } => {
            refused(operation, target, ProviderRefusal::Unauthorized, detail)
        }
        ProviderError::PermissionDenied { detail } => {
            refused(operation, target, ProviderRefusal::PermissionDenied, detail)
        }
        ProviderError::NotFound { detail } => {
            refused(operation, target, ProviderRefusal::NotFound, detail)
        }
        ProviderError::RateLimited { detail, .. } => {
            refused(operation, target, ProviderRefusal::RateLimited, detail)
        }
        ProviderError::Unavailable => ErrorLine::ProviderUnavailable { operation, target },
        ProviderError::Internal(_) => ErrorLine::ProviderFailed { operation, target },
    }
}

fn refused(
    operation: ProviderOperation,
    target: String,
    reason: ProviderRefusal,
    detail: ProviderDetail,
) -> ErrorLine {
    ErrorLine::ProviderRefused {
        operation,
        target,
        reason,
        detail,
    }
}

impl fmt::Display for ReportLine {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::IntendedProduct { key, name } => write!(
                formatter,
                "product {key} intended name={} active=true metadata.mokly_lookup_key={key}",
                json_string(name)?
            ),
            Self::IntendedPrice {
                key,
                product,
                currency,
                unit_amount,
                interval,
                usage_type,
                tax_behavior,
                nickname,
                seat_kind,
            } => write!(
                formatter,
                "price {key} intended product={product} currency={currency} unit_amount={unit_amount} recurring.interval={interval} recurring.usage_type={usage_type} tax_behavior={tax_behavior} nickname={} metadata.mokly_seat_kind={seat_kind}",
                json_string(nickname)?
            ),
            Self::Product { key, action } => write!(formatter, "product {key} {action}"),
            Self::Price { key, action } => write!(formatter, "price {key} {action}"),
        }
    }
}

impl fmt::Display for ObjectAction {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::WouldCreate => formatter.write_str("would create"),
            Self::WouldUpdate(id) => write!(formatter, "would update {id}"),
            Self::Created(id) => write!(formatter, "created {id}"),
            Self::Updated(id) => write!(formatter, "updated {id}"),
            Self::Validated(id) => write!(formatter, "validated {id}"),
        }
    }
}

impl fmt::Display for PriceAction {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Object(action) => action.fmt(formatter),
            Self::WouldReplace(old) => write!(formatter, "would replace {old} -> pending"),
            Self::Replaced { old, new } => write!(formatter, "replaced {old} -> {new}"),
            Self::Current(id) => write!(formatter, "current {id}"),
            Self::WouldArchive(id) => write!(formatter, "would archive {id}"),
            Self::Archived(id) => write!(formatter, "archived {id}"),
            Self::Kept { id, until } => write!(formatter, "kept {id} until {until}"),
        }
    }
}

fn json_string(value: &str) -> Result<String, fmt::Error> {
    match serde_json::to_string(value) {
        Ok(value) => Ok(value),
        Err(_) => Err(fmt::Error),
    }
}
