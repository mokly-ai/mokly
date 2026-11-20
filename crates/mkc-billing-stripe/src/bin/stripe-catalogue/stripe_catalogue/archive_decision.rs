//! Pure product, replacement-chain, sweep, retention, and ordering decisions.

use std::collections::BTreeSet;

use mkc_billing_interface::catalogue::Product;
use mkc_billing_interface::objects::Price;
use mkc_domain::billing::{
    Catalogue, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA, SeatPrice,
};

use super::decision::REPLACED_PRICE_METADATA;

const MAX_REPLACEMENT_LINKS: usize = 20;
const RETENTION_SECONDS: i64 = 24 * 60 * 60;

/// Read-only product resolution for an archive run.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ArchiveProductDecision {
    /// One active catalogue product can be adopted.
    Adopted(String),
    /// No active catalogue product exists.
    Missing { lookup_key: String },
    /// More than one active product claims the catalogue identity.
    DuplicateActive {
        lookup_key: String,
        products: Vec<String>,
    },
}

/// Current chain candidates plus the next price that IO must retrieve.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ChainAssembly {
    pub(crate) candidates: BTreeSet<String>,
    pub(crate) next: Option<String>,
}

/// Age-based action for every superseded price belonging to one current price.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RetentionDecision {
    /// Keep candidates until this Unix timestamp.
    Keep { until: i64 },
    /// The current price has reached the retention threshold.
    Archive,
    /// The provider timestamp cannot represent the retention threshold.
    InvalidTimestamp,
}

/// Resolve an active product without proposing or applying a write.
pub(crate) fn decide_archive_product(
    catalogue: &Catalogue,
    products: &[Product],
) -> ArchiveProductDecision {
    let mut active = products
        .iter()
        .filter(|product| product.active)
        .filter(|product| {
            product
                .metadata
                .get(PRODUCT_LOOKUP_KEY_METADATA)
                .is_some_and(|key| key == catalogue.product.lookup_key)
        })
        .map(|product| product.id.clone())
        .collect::<Vec<_>>();
    active.sort();
    match active.as_slice() {
        [id] => ArchiveProductDecision::Adopted(id.clone()),
        [] => ArchiveProductDecision::Missing {
            lookup_key: catalogue.product.lookup_key.to_owned(),
        },
        _ => ArchiveProductDecision::DuplicateActive {
            lookup_key: catalogue.product.lookup_key.to_owned(),
            products: active,
        },
    }
}

/// Assemble up to twenty replacement links from already retrieved prices.
pub(crate) fn assemble_replacement_chain(
    current: &Price,
    retrieved: &[Price],
    missing: &BTreeSet<String>,
    excluded: &BTreeSet<String>,
) -> ChainAssembly {
    let mut candidates = BTreeSet::new();
    let mut visited = BTreeSet::from([current.id.clone()]);
    let mut next = replacement_link(current).map(str::to_owned);
    let mut links = 0;
    while let Some(id) = next {
        if links == MAX_REPLACEMENT_LINKS || !visited.insert(id.clone()) {
            return ChainAssembly {
                candidates,
                next: None,
            };
        }
        links += 1;
        if missing.contains(&id) {
            return ChainAssembly {
                candidates,
                next: None,
            };
        }
        let Some(price) = retrieved.iter().find(|price| price.id == id) else {
            return ChainAssembly {
                candidates,
                next: Some(id),
            };
        };
        if price.active && !excluded.contains(&price.id) {
            candidates.insert(price.id.clone());
        }
        next = replacement_link(price).map(str::to_owned);
    }
    ChainAssembly {
        candidates,
        next: None,
    }
}

/// Select active, keyless or non-catalogue prices for one seat kind.
pub(crate) fn select_product_sweep(
    catalogue: &Catalogue,
    seat: &SeatPrice,
    prices: &[Price],
    excluded: &BTreeSet<String>,
) -> BTreeSet<String> {
    prices
        .iter()
        .filter(|price| price.active && !excluded.contains(&price.id))
        .filter(|price| {
            price
                .metadata
                .get(PRICE_SEAT_KIND_METADATA)
                .is_some_and(|kind| kind == seat.kind.as_str())
        })
        .filter(|price| {
            price
                .lookup_key
                .as_deref()
                .is_none_or(|key| !catalogue.seats.iter().any(|seat| seat.lookup_key == key))
        })
        .map(|price| price.id.clone())
        .collect()
}

/// Merge sources, remove current prices, de-duplicate, and return bytewise order.
pub(crate) fn ordered_superseded(
    chain: &BTreeSet<String>,
    sweep: &BTreeSet<String>,
    excluded: &BTreeSet<String>,
) -> Vec<String> {
    chain
        .union(sweep)
        .filter(|id| !excluded.contains(*id))
        .cloned()
        .collect()
}

/// Decide whether a current price has completed its 24-hour hold.
pub(crate) fn decide_retention(created: i64, now: i64) -> RetentionDecision {
    match created.checked_add(RETENTION_SECONDS) {
        Some(until) if until > now => RetentionDecision::Keep { until },
        Some(_) => RetentionDecision::Archive,
        None => RetentionDecision::InvalidTimestamp,
    }
}

fn replacement_link(price: &Price) -> Option<&str> {
    price
        .metadata
        .get(REPLACED_PRICE_METADATA)
        .map(String::as_str)
        .filter(|id| !id.is_empty())
}
