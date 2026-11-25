//! Portable token paths resolve per document without changing comments or invalid paths.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::diagnostic_code::Code;
use mokly_html::tree::{Node, element};
use mokly_html::{parse, serialize};
use mokly_model::namespace;

use crate::asset_tokens::rewrite;
use crate::error::GraphError;

const HOME: &str = "home/index.html";
const IMAGE: &str = "<img src='mokly-asset:[specs/logo.png]'>";

fn iframe(srcdoc: &str) -> Node {
    element("iframe", &[("srcdoc", srcdoc)], vec![])
}

fn assert_base_error(error: GraphError, expected: &str) {
    let GraphError::Invalid {
        code,
        route,
        message,
    } = error
    else {
        panic!("expected a base URL error, got {error}");
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(route, HOME);
    assert_eq!(message, expected);
}

#[test]
fn asset_tokens_rewrite_attributes_srcset_styles_and_text_at_each_document_depth() {
    let source = concat!(
        "<img src='mokly-asset:[specs/logo.png]?size=2#mark' ",
        "srcset='mokly-asset:[specs/logo.png] 1x, mokly-asset:[node_modules/@icons/icon.svg] 2x' ",
        "style='background:url(mokly-asset:[specs/logo.png]#background)' ",
        "data-src='mokly-asset:[node_modules/@icons/icon.svg]'>",
        "<p>beforemokly-asset:[specs/logo.png]after",
        "mokly-asset:[node_modules/@icons/icon.svg]",
        " mokly-asset:[unknown.png] mokly-asset:[specs/logo.png.extra]",
        " mokly-asset:[specs/not portable.png]</p>",
        "<p>mokly-asset:[node_modules/.mokly-roots//image.png]</p>",
        "<!--mokly-asset:[specs/logo.png]-->",
    );
    let original = parse::html(DeliveredHtml::fragment(source));
    for (route, prefix) in [
        ("home/index.html", "../"),
        ("nested/home/index.html", "../../"),
    ] {
        let mut nodes = original.clone();
        rewrite(&mut nodes, route).unwrap();
        assert_eq!(
            serialize::html(&nodes),
            format!(
                "<img src=\"{prefix}assets/specs/logo.png?size=2#mark\" srcset=\"{prefix}assets/specs/logo.png 1x, {prefix}assets/node_modules/%40icons/icon.svg 2x\" style=\"background:url({prefix}assets/specs/logo.png#background)\" data-src=\"{prefix}assets/node_modules/%40icons/icon.svg\"><p>before{prefix}assets/specs/logo.pngafter{prefix}assets/node_modules/%40icons/icon.svg {prefix}assets/unknown.png {prefix}assets/specs/logo.png.extra mokly-asset:[specs/not portable.png]</p><p>mokly-asset:[node_modules/.mokly-roots//image.png]</p><!--mokly-asset:[specs/logo.png]-->"
            )
        );
    }
}

#[test]
fn base_urls_fail_only_when_they_redirect_replaced_asset_tokens() {
    let route = "nested/home/index.html";
    let asset = "<img src='mokly-asset:[specs/logo.png]'>";
    let sample_origin = format!(
        "<base href='//mokly.invalid/{}'>",
        namespace::generated(route)
    );
    for (head, body, redirects) in [
        ("<base href='elsewhere/'>", asset, true),
        ("<base href='https://example.com/'>", asset, true),
        ("<base href='//example.com/'>", asset, true),
        (sample_origin.as_str(), asset, true),
        ("<base target='_blank'><base href='../'>", asset, true),
        ("<base href=''>", asset, false),
        ("<base href='./'><base href='elsewhere/'>", asset, false),
        ("<base href='#top'>", asset, false),
        ("<base href='?q=1'>", asset, false),
        ("<base href='index.html'>", asset, false),
        ("<base href='data:text/plain,ignored'>", asset, false),
        ("<base href='javascript:void(0)'>", asset, false),
        ("<base target='_blank'>", asset, false),
        (
            "<template><base href='elsewhere/'></template>",
            asset,
            false,
        ),
        ("<base href='elsewhere/'>", "<p>No asset</p>", false),
        (
            "<base href='elsewhere/'>",
            "<p>mokly-asset:[specs/bad name.png]</p>",
            false,
        ),
    ] {
        let source = format!("<!doctype html><head>{head}</head><body>{body}</body>");
        let mut nodes = parse::html(DeliveredHtml::document(&source));
        let actual = rewrite(&mut nodes, route).map_err(|error| {
            let GraphError::Invalid {
                code,
                route,
                message,
            } = error
            else {
                panic!("unexpected diagnostic for {head}: {error}");
            };
            (code, route, message)
        });
        let expected = if redirects {
            Err((
                Code::BuildInvalid,
                route.to_owned(),
                "nested/home/index.html: <base href> redirects the imported asset URLs of this document; remove <base href>".to_owned(),
            ))
        } else {
            Ok(())
        };
        assert_eq!(actual, expected, "{head} {body}");
    }
}

#[test]
fn a_sibling_directory_base_keeps_imported_asset_destinations() {
    let source = format!("<base href='../other/'>{IMAGE}");
    let mut nodes = parse::html(DeliveredHtml::document(&source));
    rewrite(&mut nodes, HOME).unwrap();
}

#[test]
fn a_base_that_keeps_the_static_destination_can_redirect_snapshot_assets() {
    let source = format!(
        "<base href='../../../{}/'>{IMAGE}",
        namespace::generated("home")
    );
    let mut nodes = parse::html(DeliveredHtml::document(&source));
    assert_base_error(
        rewrite(&mut nodes, HOME).unwrap_err(),
        "home/index.html: <base href> redirects the imported asset URLs of this document; remove <base href>",
    );
}

#[test]
fn iframe_bases_are_checked_and_the_srcdoc_text_keeps_its_spelling() {
    let unchanged =
        "<!doctype html><base href='./'><IMG  SRC=\"mokly-asset:[specs/logo.png]?v=2#mark\">";
    let mut nodes = [iframe(unchanged)];
    rewrite(&mut nodes, HOME).unwrap();
    let [Node::Element(frame)] = &nodes else {
        panic!("expected an iframe");
    };
    assert_eq!(
        frame.get("srcdoc"),
        Some("<!doctype html><base href='./'><IMG  SRC=\"../assets/specs/logo.png?v=2#mark\">")
    );

    let mut nodes = [iframe(&format!("<base href='elsewhere/'>{IMAGE}"))];
    assert_base_error(
        rewrite(&mut nodes, HOME).unwrap_err(),
        "home/index.html: <base href> in an <iframe srcdoc> document redirects its imported asset URLs; remove <base href>",
    );
}

#[test]
fn a_nested_srcdoc_inherits_the_enclosing_document_base() {
    let nested = serialize::html(&[iframe(&format!("<base href='./'>{IMAGE}"))]);
    let mut nodes = [iframe(&format!("<base href='elsewhere/'>{nested}"))];
    assert_base_error(
        rewrite(&mut nodes, HOME).unwrap_err(),
        "home/index.html: <base href> in an <iframe srcdoc> document redirects its imported asset URLs; remove <base href>",
    );
}

#[test]
fn a_srcdoc_that_keeps_an_inherited_redirect_reports_the_outer_base() {
    let mut nodes = [
        element("base", &[("href", "elsewhere/index.html")], vec![]),
        iframe(&format!("<base href='./'>{IMAGE}")),
    ];
    assert_base_error(
        rewrite(&mut nodes, HOME).unwrap_err(),
        "home/index.html: <base href> redirects the imported asset URLs of this document; remove <base href>",
    );
}
