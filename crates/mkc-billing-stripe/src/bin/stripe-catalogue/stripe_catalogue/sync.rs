//! Catalogue reconciliation orchestration over injected provider traits.

use std::sync::Arc;

use mkc_billing_interface::catalogue_provider::{CatalogueProvider, RunId};
use mkc_billing_interface::error::Result as ProviderResult;
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::billing::{Catalogue, IdentityViolation};

use super::decision::{PriceDecision, decide_price, find_price};
use super::report::{
    ErrorLine, ObjectAction, PriceAction, ProviderOperation, ReportLine, intended_lines,
    provider_error,
};
use super::run_ids::RunIds;

/// Complete result of one reconciliation attempt, including partial progress.
pub(crate) type SyncResult = Result<Vec<ReportLine>, FailedSync>;

/// A failed reconciliation and every line completed before the failure.
#[derive(Debug)]
pub(crate) struct FailedSync {
    pub(crate) lines: Vec<ReportLine>,
    pub(crate) error: ErrorLine,
}

/// Replaceable Stripe catalogue orchestration used by the command boundary.
#[cfg_attr(test, unimock::unimock(api = [CatalogueSyncMock]))]
pub(crate) trait CatalogueSync: Send + Sync {
    /// Read and optionally reconcile the supplied typed catalogue.
    fn sync(&self, catalogue: &Catalogue, apply: bool) -> SyncResult;
}

/// Provider-backed catalogue synchronizer.
pub(crate) struct ProviderCatalogueSync {
    pub(crate) catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync>,
    pub(crate) billing_provider: Arc<dyn BillingProvider + Send + Sync>,
    pub(crate) run_ids: Arc<dyn RunIds + Send + Sync>,
}

pub(super) struct RunState {
    pub(super) run: RunId,
    pub(super) lines: Vec<ReportLine>,
}

pub(super) enum ProductResolution {
    Pending,
    Existing(String),
}

impl CatalogueSync for ProviderCatalogueSync {
    fn sync(&self, catalogue: &Catalogue, apply: bool) -> SyncResult {
        let run = match self.run_ids.next() {
            Ok(run) => run,
            Err(error) => {
                return Err(FailedSync {
                    lines: Vec::new(),
                    error: provider_error(error, ProviderOperation::ListProducts, "catalogue"),
                });
            }
        };
        let mut state = RunState {
            run,
            lines: Vec::new(),
        };
        match self.run(catalogue, apply, &mut state) {
            Ok(()) => Ok(state.lines),
            Err(error) => Err(FailedSync {
                lines: state.lines,
                error,
            }),
        }
    }
}

impl ProviderCatalogueSync {
    fn run(
        &self,
        catalogue: &Catalogue,
        apply: bool,
        state: &mut RunState,
    ) -> Result<(), ErrorLine> {
        validate_identity(catalogue)?;
        let products = provider_result(
            self.catalogue_provider.list_products(),
            ProviderOperation::ListProducts,
            "catalogue",
        )?;
        let product = self.resolve_product(catalogue, products, apply, state)?;
        let lookup_keys = catalogue
            .seats
            .iter()
            .map(|seat| seat.lookup_key.to_owned())
            .collect::<Vec<_>>();
        let prices = provider_result(
            self.billing_provider
                .list_prices_by_lookup_keys(&lookup_keys),
            ProviderOperation::ListPrices,
            "catalogue",
        )?;
        match product {
            ProductResolution::Pending => {
                reconcile_pending_prices(catalogue, &prices, state);
                Ok(())
            }
            ProductResolution::Existing(product_id) => {
                self.reconcile_prices(catalogue, &product_id, &prices, apply, state)
            }
        }
    }
}

/// Validate and render the entirely offline intended catalogue.
pub(crate) fn check(catalogue: &Catalogue) -> Result<Vec<ReportLine>, ErrorLine> {
    validate_identity(catalogue)?;
    Ok(intended_lines(catalogue))
}

fn reconcile_pending_prices(catalogue: &Catalogue, prices: &[Price], state: &mut RunState) {
    for seat in &catalogue.seats {
        match decide_price(
            catalogue,
            seat,
            None,
            find_price(prices, seat.lookup_key),
            state.run.clone(),
        ) {
            PriceDecision::Create(_) => push_price(
                state,
                seat.lookup_key,
                PriceAction::Object(ObjectAction::WouldCreate),
            ),
            PriceDecision::Replace {
                predecessor,
                repair,
                ..
            } => {
                if repair.is_some() {
                    push_price(
                        state,
                        seat.lookup_key,
                        PriceAction::Object(ObjectAction::WouldUpdate(predecessor.clone())),
                    );
                }
                push_price(
                    state,
                    seat.lookup_key,
                    PriceAction::WouldReplace(predecessor),
                );
            }
            PriceDecision::Update { id, .. } => push_price(
                state,
                seat.lookup_key,
                PriceAction::Object(ObjectAction::WouldUpdate(id)),
            ),
            PriceDecision::Validated { id } => push_price(
                state,
                seat.lookup_key,
                PriceAction::Object(ObjectAction::Validated(id)),
            ),
        }
    }
}

pub(super) fn validate_identity(catalogue: &Catalogue) -> Result<(), ErrorLine> {
    if let Some(violation) = catalogue.identity_violations().first() {
        let field = match violation {
            IdentityViolation::InvalidLookupKey { .. }
            | IdentityViolation::DuplicateLookupKey { .. } => "lookup-key",
            IdentityViolation::ProductPlanNotTeam { .. } => "product.plan",
            IdentityViolation::EmptyProductName => "product.name",
            IdentityViolation::EmptyPriceNickname { .. } => "price.nickname",
        };
        return Err(ErrorLine::InvalidCatalogueIdentity { field });
    }
    Ok(())
}

pub(super) fn provider_result<T>(
    result: ProviderResult<T>,
    operation: ProviderOperation,
    target: &str,
) -> Result<T, ErrorLine> {
    match result {
        Ok(value) => Ok(value),
        Err(error) => Err(provider_error(error, operation, target)),
    }
}

fn push_price(state: &mut RunState, key: &str, action: PriceAction) {
    state.lines.push(ReportLine::Price {
        key: key.to_owned(),
        action,
    });
}
