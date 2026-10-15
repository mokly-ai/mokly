//! Markers in raw text remain text and produce only a route warning.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};

use crate::tree::Node;

pub(crate) fn warnings(nodes: &[Node], route: &str, output: &mut Vec<Warning>) {
    for node in nodes {
        if let Node::Element(element) = node {
            if matches!(
                element.name.as_str(),
                "script" | "style" | "textarea" | "title"
            ) && element
                .children
                .iter()
                .any(|node| matches!(node, Node::Text(text) if text.contains("<!--mokly-")))
            {
                output.push(Warning {
                    code: "marker-in-raw-text",
                    subject: WarningSubject::Route(route.into()),
                    message: format!("marker in raw text <{}> is ignored", element.name),
                });
            }
            warnings(&element.children, route, output);
        }
    }
}
