//! Parse HTML into owned trees. The input type chooses the authored or the delivered parse.

use mokly_catalogue::html_input::HtmlInput;

use crate::pipeline;
use crate::tree::Node;

/// Parse authored or delivered HTML.
///
/// Authored input drops unknown ignore-wrapper attributes, and records source positions when it
/// has an origin. Delivered input keeps every attribute, as a browser does.
pub fn html<'a>(input: impl Into<HtmlInput<'a>>) -> Vec<Node> {
    pipeline::parse(input.into())
}
