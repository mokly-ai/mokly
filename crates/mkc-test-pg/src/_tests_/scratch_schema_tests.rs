//! Pure URL scoping checks for scratch schemas.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use url::Url;

use super::scope_url;

#[test]
fn scoped_url_preserves_query_parameters_and_encodes_search_path() {
    let url = scope_url(
        "postgres://user:pass@localhost/db?application_name=smoke",
        "billing_abc",
    )
    .unwrap();
    let parsed = Url::parse(&url).unwrap();
    let parameters: Vec<_> = parsed.query_pairs().collect();
    assert_eq!(parameters[0].0, "application_name");
    assert_eq!(parameters[0].1, "smoke");
    assert_eq!(parameters[1].0, "options");
    assert_eq!(parameters[1].1, "-csearch_path=billing_abc");
}
