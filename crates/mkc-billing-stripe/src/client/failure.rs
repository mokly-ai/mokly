//! Internal invariants that provider callers cannot handle directly.

use std::fmt::{self, Display, Formatter};

use thiserror::Error;

/// Cursor-paginated catalogue listing named by a pagination failure.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Listing {
    /// Every product, active and archived.
    Products,
    /// One product's active prices.
    ProductPrices,
}

impl Display for Listing {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Products => "product",
            Self::ProductPrices => "product-price",
        })
    }
}

#[derive(Debug, Error)]
pub(super) enum ClientFailure {
    #[error("[mkc-billing-stripe/client] delete response did not confirm the requested item")]
    DeleteNotConfirmed,
    #[error("[mkc-billing-stripe/client] lookup-key price response unexpectedly has more pages")]
    LookupPricesHaveMore,
    #[error("[mkc-billing-stripe/client] lookup-key price response omitted has_more")]
    LookupPricesPaginationMissing,
    #[error("[mkc-billing-stripe/client] {listing} pagination exceeded 100 pages")]
    CataloguePageLimit { listing: Listing },
    #[error("[mkc-billing-stripe/client] {listing} page has_more without a cursor")]
    CatalogueCursorMissing { listing: Listing },
    #[error("[mkc-billing-stripe/client] {listing} page omitted has_more")]
    CataloguePaginationMissing { listing: Listing },
}
