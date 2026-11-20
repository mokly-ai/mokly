//! Document-local replacement of tokens with portable asset paths.

use mokly_css::paths;
use mokly_html::tree::Node;
use mokly_model::routes;

const PREFIX: &str = "mokly-asset:[";

/// Replace portable asset tokens after composition and before URL checks.
pub(crate) fn rewrite(nodes: &mut [Node], route: &str) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => {
                for attribute in &mut element.attributes {
                    replace(&mut attribute.value, route);
                }
                if let Some(records) = &mut element.style_attribution {
                    for record in records {
                        replace(&mut record.css, route);
                    }
                }
                pending.extend(element.children.iter_mut().rev());
            }
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
            Node::Text(value) => replace(value, route),
            Node::Comment(_) | Node::Doctype(_) => {}
        }
    }
}

fn replace(value: &mut String, route: &str) {
    if !value.contains(PREFIX) {
        return;
    }
    let mut output = String::with_capacity(value.len());
    let mut rest = value.as_str();
    while let Some(start) = rest.find(PREFIX) {
        let name = &rest[start + PREFIX.len()..];
        let Some(end) = name.find(']') else {
            break;
        };
        output.push_str(&rest[..start]);
        let path = &name[..end];
        if paths::portable(path, true) {
            output.push_str(&routes::relative(route, &format!("assets/{path}")));
        } else {
            output.push_str(&rest[start..start + PREFIX.len() + end + 1]);
        }
        rest = &name[end + 1..];
    }
    output.push_str(rest);
    *value = output;
}

#[cfg(test)]
#[path = "_tests_/asset_tokens_tests.rs"]
mod asset_tokens_tests;
