//! Superseded-price archival over injected provider, clock, and run-id traits.

use std::collections::BTreeSet;
use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use mkc_billing_interface::catalogue::Product;
use mkc_billing_interface::catalogue_provider::{CatalogueProvider, RunId, UpdatePrice};
use mkc_billing_interface::credentials::Clock;
use mkc_billing_interface::error::Error as ProviderError;
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::billing::Catalogue;

use super::archive_decision::{
    ArchiveProductDecision, ChainAssembly, RetentionDecision, assemble_replacement_chain,
    decide_archive_product, decide_retention, ordered_superseded, select_product_sweep,
};
use super::decision::find_price;
use super::report::{ErrorLine, PriceAction, ProviderOperation, ReportLine, provider_error};
use super::run_ids::RunIds;
use super::sync::{provider_result, validate_identity};

/// Complete result of one archive attempt, including partial progress.
pub(crate) type ArchiveResult = Result<Vec<ReportLine>, FailedArchive>;

/// A failed archive attempt and every line completed before the failure.
#[derive(Debug)]
pub(crate) struct FailedArchive {
    pub(crate) lines: Vec<ReportLine>,
    pub(crate) error: ErrorLine,
}

/// Replaceable archive orchestration used by the command boundary.
#[cfg_attr(test, unimock::unimock(api = [CatalogueArchiveMock]))]
pub(crate) trait CatalogueArchive: Send + Sync {
    /// Read superseded prices and optionally archive eligible candidates.
    fn archive(&self, catalogue: &Catalogue, apply: bool) -> ArchiveResult;
}

/// Provider-backed catalogue archiver.
pub(crate) struct ProviderCatalogueArchive {
    pub(crate) catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync>,
    pub(crate) billing_provider: Arc<dyn BillingProvider + Send + Sync>,
    pub(crate) run_ids: Arc<dyn RunIds + Send + Sync>,
    pub(crate) clock: Arc<dyn Clock + Send + Sync>,
}

struct ArchiveState {
    run: RunId,
    now: i64,
    lines: Vec<ReportLine>,
}

impl CatalogueArchive for ProviderCatalogueArchive {
    fn archive(&self, catalogue: &Catalogue, apply: bool) -> ArchiveResult {
        let run = match self.run_ids.next() {
            Ok(run) => run,
            Err(error) => {
                return Err(FailedArchive {
                    lines: Vec::new(),
                    error: provider_error(error, ProviderOperation::ListProducts, "catalogue"),
                });
            }
        };
        let mut state = ArchiveState {
            run,
            now: self.clock.now().timestamp(),
            lines: Vec::new(),
        };
        match self.run(catalogue, apply, &mut state) {
            Ok(()) => Ok(state.lines),
            Err(error) => Err(FailedArchive {
                lines: state.lines,
                error,
            }),
        }
    }
}

impl ProviderCatalogueArchive {
    fn run(
        &self,
        catalogue: &Catalogue,
        apply: bool,
        state: &mut ArchiveState,
    ) -> Result<(), ErrorLine> {
        validate_identity(catalogue)?;
        let products = provider_result(
            self.catalogue_provider.list_products(),
            ProviderOperation::ListProducts,
            "catalogue",
        )?;
        let product = resolve_product(catalogue, &products)?;
        let lookup_keys = catalogue
            .seats
            .iter()
            .map(|seat| seat.lookup_key.to_owned())
            .collect::<Vec<_>>();
        let listed = provider_result(
            self.billing_provider
                .list_prices_by_lookup_keys(&lookup_keys),
            ProviderOperation::ListPrices,
            "catalogue",
        )?;
        let current = current_prices(catalogue, &listed)?;
        let excluded = current
            .iter()
            .map(|price| price.id.clone())
            .collect::<BTreeSet<_>>();
        let product_prices = provider_result(
            self.catalogue_provider.list_product_prices(&product),
            ProviderOperation::ListProductPrices,
            &product,
        )?;
        for (seat, price) in catalogue.seats.iter().zip(&current) {
            state.lines.push(ReportLine::Price {
                key: seat.lookup_key.to_owned(),
                action: PriceAction::Current(price.id.clone()),
            });
            let chain = self.retrieve_chain(price, &excluded)?;
            let sweep = select_product_sweep(catalogue, seat, &product_prices, &excluded);
            let candidates = ordered_superseded(&chain, &sweep, &excluded);
            self.apply_retention(seat.lookup_key, price, candidates, apply, state)?;
        }
        Ok(())
    }

    fn retrieve_chain(
        &self,
        current: &Price,
        excluded: &BTreeSet<String>,
    ) -> Result<BTreeSet<String>, ErrorLine> {
        let mut retrieved = Vec::new();
        let mut missing = BTreeSet::new();
        loop {
            let ChainAssembly { candidates, next } =
                assemble_replacement_chain(current, &retrieved, &missing, excluded);
            let Some(id) = next else {
                return Ok(candidates);
            };
            match self.catalogue_provider.retrieve_price(&id) {
                Ok(price) if price.id == id => retrieved.push(price),
                Ok(_) => {
                    return Err(ErrorLine::ProviderFailed {
                        operation: ProviderOperation::RetrievePrice,
                        target: id,
                    });
                }
                Err(ProviderError::NotFound { .. }) => {
                    missing.insert(id);
                }
                Err(error) => {
                    return Err(provider_error(error, ProviderOperation::RetrievePrice, &id));
                }
            }
        }
    }

    fn apply_retention(
        &self,
        key: &str,
        current: &Price,
        candidates: Vec<String>,
        apply: bool,
        state: &mut ArchiveState,
    ) -> Result<(), ErrorLine> {
        match decide_retention(current.created, state.now) {
            RetentionDecision::Keep { until } => {
                let until = retention_time(until)?;
                for id in candidates {
                    push_price(
                        state,
                        key,
                        PriceAction::Kept {
                            id,
                            until: until.clone(),
                        },
                    );
                }
            }
            RetentionDecision::Archive => {
                for id in candidates {
                    if apply {
                        self.archive_price(&id, state.run.clone())?;
                        push_price(state, key, PriceAction::Archived(id));
                    } else {
                        push_price(state, key, PriceAction::WouldArchive(id));
                    }
                }
            }
            RetentionDecision::InvalidTimestamp => {
                return Err(ErrorLine::ProviderFailed {
                    operation: ProviderOperation::ListPrices,
                    target: "catalogue".to_owned(),
                });
            }
        }
        Ok(())
    }

    fn archive_price(&self, id: &str, run: RunId) -> Result<(), ErrorLine> {
        let input = UpdatePrice {
            run,
            nickname: None,
            metadata: Default::default(),
            active: Some(false),
        };
        provider_result(
            self.catalogue_provider.update_price(id, &input),
            ProviderOperation::PriceArchive,
            id,
        )?;
        Ok(())
    }
}

fn resolve_product(catalogue: &Catalogue, products: &[Product]) -> Result<String, ErrorLine> {
    match decide_archive_product(catalogue, products) {
        ArchiveProductDecision::Adopted(id) => Ok(id),
        ArchiveProductDecision::Missing { lookup_key } => {
            Err(ErrorLine::MissingProduct { lookup_key })
        }
        ArchiveProductDecision::DuplicateActive {
            lookup_key,
            products,
        } => Err(ErrorLine::DuplicateActiveProducts {
            lookup_key,
            products,
        }),
    }
}

fn current_prices(catalogue: &Catalogue, prices: &[Price]) -> Result<Vec<Price>, ErrorLine> {
    let mut current = Vec::new();
    for seat in &catalogue.seats {
        let Some(price) = find_price(prices, seat.lookup_key) else {
            return Err(ErrorLine::MissingCurrentPrice {
                lookup_key: seat.lookup_key.to_owned(),
            });
        };
        current.push(price.clone());
    }
    Ok(current)
}

fn retention_time(timestamp: i64) -> Result<String, ErrorLine> {
    match DateTime::<Utc>::from_timestamp(timestamp, 0) {
        Some(value) => Ok(value.to_rfc3339_opts(SecondsFormat::Secs, true)),
        None => Err(ErrorLine::ProviderFailed {
            operation: ProviderOperation::ListPrices,
            target: "catalogue".to_owned(),
        }),
    }
}

fn push_price(state: &mut ArchiveState, key: &str, action: PriceAction) {
    state.lines.push(ReportLine::Price {
        key: key.to_owned(),
        action,
    });
}
