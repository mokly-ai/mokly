//! Lookup-key price listing remains injectable through the billing mock.

use unimock::{MockFn, Unimock, matching};

use crate::provider::{BillingProvider, BillingProviderMock};

#[test]
fn billing_provider_mock_supports_lookup_key_listing() {
    let mock = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(Vec::new())),
    );
    let provider: &dyn BillingProvider = &mock;
    let lookup_keys = ["mokly_team_editor_usd_month".to_owned()];
    assert!(matches!(
        provider.list_prices_by_lookup_keys(&lookup_keys),
        Ok(prices) if prices.is_empty()
    ));
}
