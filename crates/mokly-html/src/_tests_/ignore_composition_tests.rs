//! Delivered callback HTML filters unknown wrapper attributes before composition.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use crate::error::Result;
use crate::fragment::{Fragment, FragmentRendererMock};
use crate::tree::{self, Node};

use super::support;

fn compose_page(wrapper: &str) -> Result<Composed> {
    let mut catalogue = support::prepared("<p>Home</p>");
    catalogue.model.entries[0].metadata.path = "page".into();
    catalogue.model.entries[0].content = EntryContent::Page;
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(Fragment {
                html: format!("<!doctype html><html><head></head><body>{wrapper}</body></html>"),
                ..Default::default()
            })),
    ));
    let entry = &catalogue.model.entries[0];
    HtmlComposer {
        fragments: renderer,
    }
    .compose(&ComposeRequest {
        catalogue: &catalogue,
        entry,
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
}

fn has_wrapper(document: &Composed) -> bool {
    tree::walk(&document.tree)
        .any(|node| matches!(node, Node::Element(element) if element.name == "mokly-ignore"))
}

#[test]
fn delivered_page_composition_filters_unknown_wrapper_attributes() {
    let document =
        compose_page("<mokly-ignore id='x' data-x='{{missing}}'>Text</mokly-ignore>").unwrap();
    assert!(!has_wrapper(&document));
}

#[test]
fn delivered_page_wrapper_link_attributes_are_not_validated() {
    for attribute in [
        "to='Not A Path'",
        "href='mock:Not A Path'",
        "data-nav-href='mock:Not A Path'",
    ] {
        let wrapper = format!("<mokly-ignore id='x' {attribute}>Text</mokly-ignore>");
        let document =
            compose_page(&wrapper).unwrap_or_else(|error| panic!("{attribute}: {error}"));
        assert!(!has_wrapper(&document), "{attribute}");
    }
}
