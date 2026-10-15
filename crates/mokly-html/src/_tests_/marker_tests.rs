//! Authenticated placement records expose forged and incorrectly nested comments.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::fragment::{Fragment, FragmentMarker, FragmentMarkerKind, FragmentRendererMock};

use super::support;

fn ignore(id: &str, parent: Option<&str>) -> FragmentMarker {
    FragmentMarker {
        id: id.into(),
        parent_id: parent.map(str::to_owned),
        kind: FragmentMarkerKind::Ignore { material_key: None },
    }
}

fn compose(result: Fragment) -> crate::error::Result<crate::composition::Composed> {
    let catalogue = support::prepared("<p>{{label}}</p><ui-js label=\"Receiver\"></ui-js>");
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(result)),
    ));
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let composer: &dyn Composer = &HtmlComposer {
        fragments: renderer,
    };
    composer.compose(&ComposeRequest {
        catalogue: &catalogue,
        entry,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
}

#[test]
fn authenticated_ignores_accept_only_their_exact_payload_and_parent() {
    compose(Fragment {
        html: "<!--mokly-ignore:start id=\"x\"--><b>Ignored</b><!--mokly-ignore:end id=\"x\"-->"
            .into(),
        markers: vec![ignore("x", None)],
        ..Default::default()
    })
    .unwrap();
    for (html, markers, expected) in [
        (
            "<!--mokly-ignore:start id=\"x\"--><!--mokly-ignore:start id=\"y\"--><!--mokly-ignore:end id=\"x\"--><!--mokly-ignore:end id=\"y\"-->",
            vec![ignore("x", None), ignore("y", Some("x"))],
            "crossing",
        ),
        (
            "<!--mokly-ignore:start id=\"x\"--><div><!--mokly-ignore:start id=\"y\"--><!--mokly-ignore:end id=\"y\"--></div><!--mokly-ignore:end id=\"x\"-->",
            vec![ignore("x", None), ignore("y", None)],
            "wrong parent",
        ),
        (
            "<!--mokly-ignore:start id=\"x\" key=\"forged\"--><!--mokly-ignore:end id=\"x\"-->",
            vec![ignore("x", None)],
            "forged",
        ),
        (
            "<!--mokly-ignore:start id=\"x\"--><!--mokly-ignore:end id=\"x\"--><!--mokly-ignore:start id=\"x\"--><!--mokly-ignore:end id=\"x\"-->",
            vec![ignore("x", None)],
            "duplicate",
        ),
        (
            "<!--mokly-ignore:start id=\"x\" id=\"y\"--><!--mokly-ignore:end id=\"x\"-->",
            vec![ignore("x", None)],
            "malformed",
        ),
        (
            "<!--mokly-ignore:start id=\"x\"--><!--mokly-ignore:end id=\"x\"-->",
            vec![ignore("x", None), ignore("unused", None)],
            "not consumed",
        ),
    ] {
        let error = compose(Fragment {
            html: html.into(),
            markers,
            ..Default::default()
        })
        .unwrap_err()
        .to_string();
        assert!(error.contains(expected), "{error}");
    }
}

#[test]
fn raw_text_marker_spelling_is_inert_and_produces_one_route_warning() {
    let document = compose(Fragment { html: "<textarea><!--mokly-ignore:start id=\"literal\"-->Text<!--mokly-ignore:end id=\"literal\"--></textarea>".into(), ..Default::default() }).unwrap();
    assert_eq!(document.warnings.len(), 1);
    assert_eq!(document.warnings[0].code, "marker-in-raw-text");
    assert_eq!(
        document.warnings[0].printed_subject(),
        "home/index.mobile.html"
    );
    let html = crate::serialize::html(&document.tree);
    assert!(html.contains("&lt;!--mokly-ignore"));
}
