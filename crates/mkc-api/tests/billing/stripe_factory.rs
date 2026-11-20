//! Real Stripe client and signature verifier pointed at the loopback recording.

use std::sync::Arc;

use mkc_api::billing_providers::{BillingProviderFactory, BillingProviders};
use mkc_api::error::{ApiErrorResultExt, Result};
use mkc_billing_interface::credentials::Secret;
use mkc_billing_stripe::client::StripeClient;
use mkc_billing_stripe::security::StripeSignatureVerifier;
use mkc_billing_stripe::transport::{
    HttpFactory, OPERATION_TIMEOUT, ReqwestFactory, VERIFICATION_TIMEOUT,
};
use mkc_config::billing::BillingSettings;

/// Recorded composition still exercises the production request and verification adapters.
pub(super) struct RecordedBillingFactory {
    pub(super) origin: String,
}

impl BillingProviderFactory for RecordedBillingFactory {
    fn create(&self, settings: &BillingSettings) -> Result<BillingProviders> {
        assert_eq!(settings.api_origin, self.origin);
        let http = ReqwestFactory
            .build(&self.origin, OPERATION_TIMEOUT)
            .context("build recorded Stripe transport")?;
        let verification = ReqwestFactory
            .build(&self.origin, VERIFICATION_TIMEOUT)
            .context("build recorded Stripe verification transport")?;
        Ok(BillingProviders {
            provider: Arc::new(StripeClient {
                http,
                key: Secret::new(settings.secret_key.clone()),
            }),
            price_provider: Arc::new(StripeClient {
                http: verification,
                key: Secret::new(settings.secret_key.clone()),
            }),
            verifier: Arc::new(StripeSignatureVerifier {
                secret: Secret::new(settings.webhook_secret.clone()),
            }),
        })
    }
}
