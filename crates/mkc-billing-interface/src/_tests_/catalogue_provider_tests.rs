//! Catalogue provider behavior remains injectable through its generated mock.

use unimock::{MockFn, Unimock, matching};

use crate::catalogue_provider::{CatalogueProvider, CatalogueProviderMock, RunId};

#[test]
fn catalogue_provider_mock_is_consumable_as_the_trait_boundary() {
    let mock = Unimock::new(
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(Vec::new())),
    );
    let provider: &dyn CatalogueProvider = &mock;
    assert!(matches!(provider.list_products(), Ok(products) if products.is_empty()));
}

#[test]
fn run_identifiers_accept_only_lowercase_128_bit_hex() {
    let value = "0123456789abcdef0123456789abcdef";
    assert!(matches!(
        RunId::new(value.to_owned()),
        Ok(run) if run.as_str() == value
    ));
    for invalid in [
        "0123456789abcdef0123456789abcde",
        "0123456789abcdef0123456789abcdef0",
        "0123456789ABCDEF0123456789ABCDEF",
        "0123456789abcdef0123456789abcdeg",
    ] {
        assert!(RunId::new(invalid.to_owned()).is_err());
    }
}
