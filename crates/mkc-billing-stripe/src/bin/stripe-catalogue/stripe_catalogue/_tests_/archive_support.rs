//! Shared injected dependencies and fixtures for archive orchestration tests.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_billing_interface::catalogue_provider::{CatalogueProvider, RunId};
use mkc_billing_interface::credentials::{Clock, ClockMock};
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProvider;
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{price, run};
use crate::stripe_catalogue::archive::ProviderCatalogueArchive;
use crate::stripe_catalogue::decision::REPLACED_PRICE_METADATA;
use crate::stripe_catalogue::run_ids::{RunIds, RunIdsMock};

pub(super) fn archiver(provider: Arc<Unimock>, now: i64) -> ProviderCatalogueArchive {
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = provider.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = provider;
    let clock: Arc<dyn Clock + Send + Sync> = Arc::new(Unimock::new(
        ClockMock::now
            .next_call(matching!())
            .returns(DateTime::<Utc>::from_timestamp(now, 0).unwrap()),
    ));
    ProviderCatalogueArchive {
        catalogue_provider,
        billing_provider,
        run_ids: fixed_run_ids(),
        clock,
    }
}

pub(super) fn current_prices(created: i64) -> Vec<Price> {
    let mut editor = price(0, "price_editor_current");
    editor.created = created;
    let mut collaborator = price(1, "price_collaborator_current");
    collaborator.created = created;
    vec![editor, collaborator]
}

pub(super) fn linked_price(index: usize, id: &str, replaces: Option<&str>, active: bool) -> Price {
    let mut value = price(index, id);
    value.active = active;
    if let Some(replaces) = replaces {
        value
            .metadata
            .insert(REPLACED_PRICE_METADATA.to_owned(), replaces.to_owned());
    }
    value
}

pub(super) fn fixed_run_ids() -> Arc<dyn RunIds + Send + Sync> {
    Arc::new(Unimock::new(
        RunIdsMock::next.next_call(matching!()).returns(Ok(run())),
    ))
}

pub(super) fn run_id() -> RunId {
    run()
}
