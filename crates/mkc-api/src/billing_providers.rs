//! Injectable billing provider composition for production and recorded tests.

use std::sync::Arc;

use mkc_billing_interface::credentials::{Secret, Sleeper};
use mkc_billing_interface::http::Http;
use mkc_billing_interface::provider::BillingProvider;
use mkc_billing_interface::webhooks::WebhookVerifier;
use mkc_billing_stripe::client::StripeClient;
use mkc_billing_stripe::runtime::ThreadSleeper;
use mkc_billing_stripe::security::StripeSignatureVerifier;
use mkc_billing_stripe::transport::{
    HttpFactory, OPERATION_TIMEOUT, ReqwestFactory, RetryingHttp, VERIFICATION_TIMEOUT,
};
use mkc_config::billing::BillingSettings;

use crate::error::{ApiErrorResultExt, Result};

/// Provider behavior shared by billing API services and workers.
pub struct BillingProviders {
    /// Typed Stripe operations.
    pub provider: Arc<dyn BillingProvider>,
    /// Price reads with a short deadline and no rate-limit retry.
    pub price_provider: Arc<dyn BillingProvider>,
    /// Raw-body Stripe signature verification.
    pub verifier: Arc<dyn WebhookVerifier>,
}

/// Replaceable billing provider factory for integration tests.
pub trait BillingProviderFactory: Send + Sync {
    /// Create provider operations and webhook verification from validated settings.
    fn create(&self, settings: &BillingSettings) -> Result<BillingProviders>;
}

/// Production Stripe composition using bounded reqwest transport.
pub struct SystemBillingProviderFactory;

impl BillingProviderFactory for SystemBillingProviderFactory {
    fn create(&self, settings: &BillingSettings) -> Result<BillingProviders> {
        let sleeper: Arc<dyn Sleeper> = Arc::new(ThreadSleeper);
        let base: Arc<dyn Http> = ReqwestFactory
            .build(&settings.api_origin, OPERATION_TIMEOUT)
            .context("initialize Stripe HTTP transport")?;
        let verification: Arc<dyn Http> = ReqwestFactory
            .build(&settings.api_origin, VERIFICATION_TIMEOUT)
            .context("initialize Stripe verification transport")?;
        let http: Arc<dyn Http> = Arc::new(RetryingHttp {
            http: base,
            sleeper,
        });
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
