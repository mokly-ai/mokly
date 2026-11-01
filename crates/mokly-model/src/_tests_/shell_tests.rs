//! Shared shell routes declare the document class and packaged Browse icon.

use crate::shell;

#[test]
fn shell_routes_declare_the_document_class() {
    let html = String::from_utf8(shell::html("Catalogue")).unwrap();
    assert!(html.starts_with("<!doctype html>\n<html lang=\"en\" class=\"mbk-document\">"));
}

#[test]
fn shell_routes_declare_the_browse_brand_icon() {
    let html = String::from_utf8(shell::html("Catalogue")).unwrap();
    assert!(html.contains(
        "<link rel=\"icon\" type=\"image/svg+xml\" href=\"/mokly-viewer/client/brand.svg\">"
    ));
    assert!(!html.contains("/favicon.ico"));
}
