//! Parse HTML into owned trees. The input type chooses the authored or the delivered parse.

use mokly_catalogue::html_input::{DeliveredHtml, HtmlInput};

use crate::pipeline::runner;
use crate::source_checks::SourceChecks;
use crate::tree::Node;

/// Parse authored or delivered HTML.
///
/// Authored input drops unknown ignore-wrapper attributes, and records source positions when it
/// has an origin. Delivered input keeps every attribute, as a browser does.
pub fn html<'a>(input: impl Into<HtmlInput<'a>>) -> Vec<Node> {
    runner::parse(input.into(), None)
}

/// Parse callback HTML while retaining checks for the caller's diagnostic phase.
pub(crate) fn consumer(input: DeliveredHtml<'_>) -> (Vec<Node>, SourceChecks<'_>) {
    let checks = SourceChecks::new(input.text(), true);
    let nodes = runner::parse(input.into(), Some(&checks));
    (nodes, checks)
}
