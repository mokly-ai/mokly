//! Stripe operator composition; the MIT task runner starts this binary.

use std::sync::Arc;

use mkc_billing_interface::catalogue_provider::CatalogueProvider;
use mkc_billing_interface::credentials::{Secret, Sleeper};
use mkc_billing_interface::http::Http;
use mkc_billing_interface::provider::BillingProvider;
use mkc_billing_stripe::client::StripeClient;
use mkc_billing_stripe::runtime::{SystemClock, ThreadSleeper};
use mkc_billing_stripe::transport::{HttpFactory, OPERATION_TIMEOUT, ReqwestFactory, RetryingHttp};
use mkc_domain::billing::CATALOGUE;

use crate::stripe_catalogue;
use crate::stripe_catalogue::archive::{CatalogueArchive, ProviderCatalogueArchive};
use crate::stripe_catalogue::args::{
    CatalogueEnvironment, OperationArgs, StripeCatalogueArgs, StripeCatalogueCommand,
};
use crate::stripe_catalogue::inputs::{ProcessCatalogueVariables, SyncInputs, read_sync_inputs};
use crate::stripe_catalogue::report::{ErrorLine, ProviderOperation, ReportLine, provider_error};
use crate::stripe_catalogue::run_ids::OsRunIds;
use crate::stripe_catalogue::sync::{CatalogueSync, ProviderCatalogueSync};

pub(super) fn run(args: StripeCatalogueArgs) -> Result<(), ErrorLine> {
    match args.command {
        StripeCatalogueCommand::Check => match stripe_catalogue::sync::check(&CATALOGUE) {
            Ok(lines) => report_lines(lines),
            Err(error) => Err(error),
        },
        StripeCatalogueCommand::Sync(args) => run_catalogue_sync(args),
        StripeCatalogueCommand::Archive(args) => run_catalogue_archive(args),
    }
}

fn run_catalogue_sync(args: OperationArgs) -> Result<(), ErrorLine> {
    let stripe = catalogue_client(args.environment)?;
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = stripe.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = stripe;
    let synchronizer: Arc<dyn CatalogueSync> = Arc::new(ProviderCatalogueSync {
        catalogue_provider,
        billing_provider,
        run_ids: Arc::new(OsRunIds),
    });
    match synchronizer.sync(&CATALOGUE, args.apply) {
        Ok(lines) => report_lines(lines),
        Err(failure) => {
            report_lines(failure.lines)?;
            Err(failure.error)
        }
    }
}

fn run_catalogue_archive(args: OperationArgs) -> Result<(), ErrorLine> {
    let stripe = catalogue_client(args.environment)?;
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = stripe.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = stripe;
    let archiver: Arc<dyn CatalogueArchive> = Arc::new(ProviderCatalogueArchive {
        catalogue_provider,
        billing_provider,
        run_ids: Arc::new(OsRunIds),
        clock: Arc::new(SystemClock),
    });
    match archiver.archive(&CATALOGUE, args.apply) {
        Ok(lines) => report_lines(lines),
        Err(failure) => {
            report_lines(failure.lines)?;
            Err(failure.error)
        }
    }
}

fn catalogue_client(environment: CatalogueEnvironment) -> Result<Arc<StripeClient>, ErrorLine> {
    let inputs = read_sync_inputs(&ProcessCatalogueVariables, environment)?;
    build_catalogue_client(inputs)
}

fn build_catalogue_client(inputs: SyncInputs) -> Result<Arc<StripeClient>, ErrorLine> {
    let base: Arc<dyn Http> = match ReqwestFactory.build(&inputs.api_origin, OPERATION_TIMEOUT) {
        Ok(http) => http,
        Err(error) => {
            return Err(provider_error(
                error,
                ProviderOperation::ListProducts,
                "catalogue",
            ));
        }
    };
    let sleeper: Arc<dyn Sleeper> = Arc::new(ThreadSleeper);
    let http: Arc<dyn Http> = Arc::new(RetryingHttp {
        http: base,
        sleeper,
    });
    Ok(Arc::new(StripeClient {
        http,
        key: Secret::new(inputs.key),
    }))
}

fn report_lines(lines: Vec<ReportLine>) -> Result<(), ErrorLine> {
    for line in lines {
        println!("{line}");
    }
    Ok(())
}
