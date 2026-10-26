//! Delivered callback HTML filters unknown wrapper attributes before composition.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::fragment::{Fragment, FragmentRendererMock};
use crate::tree::{self, Node};

use super::support;

#[test]
fn delivered_page_composition_filters_unknown_wrapper_attributes() {
    let mut catalogue = support::prepared("<p>Home</p>");
    catalogue.model.entries[0].metadata.path = "page".into();
    catalogue.model.entries[0].content = EntryContent::Page;
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(Fragment {
                html: "<!doctype html><html><head></head><body><mokly-ignore id='x' data-x='{{missing}}'>Text</mokly-ignore></body></html>".into(),
                ..Default::default()
            })),
    ));
    let entry = &catalogue.model.entries[0];
    let document = HtmlComposer {
        fragments: renderer,
    }
    .compose(&ComposeRequest {
        catalogue: &catalogue,
        entry,
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
    .unwrap();
    assert!(
        tree::walk(&document.tree).all(|node| {
            !matches!(node, Node::Element(element) if element.name == "mokly-ignore")
        })
    );
}
