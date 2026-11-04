//! Typed result access after the request selects the wire decoder.

use crate::definitions::Definitions;
use crate::results;
use crate::wire::MethodResult;

impl MethodResult {
    /// Take the package version decoded for the hello request.
    pub(crate) fn into_hello(self) -> results::Hello {
        let value = match self {
            Self::Hello(value) => Some(value),
            _ => None,
        };
        value.expect("hello requests select the hello result decoder")
    }

    /// Take the bundle result decoded for a bundle request.
    pub fn into_bundle(self) -> results::Bundle {
        let value = match self {
            Self::Bundle(value) => Some(value),
            _ => None,
        };
        value.expect("bundle requests select the bundle result decoder")
    }

    /// Take the definitions decoded for a describe request.
    pub fn into_definitions(self) -> Definitions {
        let value = match self {
            Self::Definitions(value) => Some(value),
            _ => None,
        };
        value.expect("describe requests select the definitions result decoder")
    }

    /// Take the fragment decoded for a screen, component, or story render request.
    pub fn into_render(self) -> results::Render {
        let value = match self {
            Self::Render(value) => Some(value),
            _ => None,
        };
        value.expect("fragment render requests select the fragment result decoder")
    }

    /// Take the complete page decoded for a page render request.
    pub fn into_page(self) -> results::Page {
        let value = match self {
            Self::Page(value) => Some(value),
            _ => None,
        };
        value.expect("page render requests select the page result decoder")
    }

    /// Take the stylesheet decoded for a processCss request.
    pub fn into_css(self) -> results::Css {
        let value = match self {
            Self::Css(value) => Some(value),
            _ => None,
        };
        value.expect("processCss requests select the stylesheet result decoder")
    }
}
