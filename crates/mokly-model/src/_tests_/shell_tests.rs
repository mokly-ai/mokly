//! Shared shell routes declare the packaged Browse icon without a favicon fallback.

use crate::shell;

#[test]
fn shell_routes_declare_the_browse_brand_icon() {
    let html = String::from_utf8(shell::html("Catalogue")).unwrap();
    assert!(html.contains(
        "<link rel=\"icon\" type=\"image/svg+xml\" href=\"/mokly-viewer/client/brand.svg\">"
    ));
    assert!(!html.contains("/favicon.ico"));
}
