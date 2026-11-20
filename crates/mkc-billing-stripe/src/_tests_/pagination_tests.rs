//! Catalogue pagination fails closed at its documented page bound.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mkc_billing_interface::catalogue_provider::CatalogueProvider;
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::{HttpMock, Method, Request};
use unimock::{MockFn, Unimock, matching};

use crate::client::catalogue::MAX_CATALOGUE_PAGES;

use super::fixtures::{client, response};

#[test]
fn product_listing_stops_after_one_hundred_pages() {
    let calls = Arc::new(AtomicUsize::new(0));
    let observed = Arc::clone(&calls);
    let page = response("products-page");
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: &Request| {
                let index = observed.fetch_add(1, Ordering::SeqCst);
                assert_eq!(request.method, Method::Get);
                assert_eq!(request.path, "/v1/products");
                let expected = if index == 0 {
                    vec![("limit".to_owned(), "100".to_owned())]
                } else {
                    vec![
                        ("limit".to_owned(), "100".to_owned()),
                        ("starting_after".to_owned(), "prod_team_fixture".to_owned()),
                    ]
                };
                assert_eq!(request.form, expected);
                Ok(page.clone())
            }))
            .n_times(MAX_CATALOGUE_PAGES),
    );
    let stripe = client(http);
    assert!(matches!(stripe.list_products(), Err(Error::Internal(_))));
    assert_eq!(calls.load(Ordering::SeqCst), MAX_CATALOGUE_PAGES);
}
