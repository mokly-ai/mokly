//! Document-local replacement of tokens with portable asset paths.

use mokly_css::paths;
use mokly_html::tree::Node;
use mokly_model::{namespace, routes};
use url::Url;

use crate::error::{Result, invalid};

const PREFIX: &str = "mokly-asset:[";

/// Replace portable asset tokens and reject a base that redirects their URLs.
pub(crate) fn rewrite(nodes: &mut [Node], route: &str) -> Result<()> {
    let mut replaced = false;
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => {
                for attribute in &mut element.attributes {
                    replaced |= replace(&mut attribute.value, route);
                }
                if let Some(records) = &mut element.style_attribution {
                    for record in records {
                        replaced |= replace(&mut record.css, route);
                    }
                }
                pending.extend(element.children.iter_mut().rev());
            }
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
            Node::Text(value) => replaced |= replace(value, route),
            Node::Comment(_) | Node::Doctype(_) => {}
        }
    }
    if replaced
        && let Some(href) = first_base_href(nodes)
        && redirects(href, route)
    {
        return Err(invalid(
            route,
            format!(
                "{route}: <base href> redirects the imported asset URLs of this document; remove <base href>"
            ),
        ));
    }
    Ok(())
}

/// Find the first HTML base with an href outside template contents.
fn first_base_href(nodes: &[Node]) -> Option<&str> {
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node
            && element.is_html()
        {
            if element.name == "base"
                && let Some(href) = element.get("href")
            {
                return Some(href);
            }
            if element.name == "template" {
                continue;
            }
        }
        pending.extend(node.children().iter().rev());
    }
    None
}

/// Check two sample origins because an explicit base can match one of them.
fn redirects(href: &str, route: &str) -> bool {
    let path = namespace::generated(&routes::encode(route));
    ["https://mokly.invalid/", "http://other.mokly.invalid/"]
        .into_iter()
        .filter_map(|origin| {
            Url::parse(origin)
                .and_then(|origin| origin.join(&path))
                .ok()
        })
        .any(|document| {
            document.join(href).is_ok_and(|base| {
                !matches!(base.scheme(), "data" | "javascript")
                    && (base.origin() != document.origin()
                        || directory(&base) != directory(&document))
            })
        })
}

fn directory(url: &Url) -> Option<&str> {
    url.path().rsplit_once('/').map(|(directory, _)| directory)
}

fn replace(value: &mut String, route: &str) -> bool {
    if !value.contains(PREFIX) {
        return false;
    }
    let mut output = String::with_capacity(value.len());
    let mut rest = value.as_str();
    let mut replaced = false;
    while let Some(start) = rest.find(PREFIX) {
        let name = &rest[start + PREFIX.len()..];
        let Some(end) = name.find(']') else {
            break;
        };
        output.push_str(&rest[..start]);
        let path = &name[..end];
        if paths::portable(path, true) {
            output.push_str(&routes::relative(route, &format!("assets/{path}")));
            replaced = true;
        } else {
            output.push_str(&rest[start..start + PREFIX.len() + end + 1]);
        }
        rest = &name[end + 1..];
    }
    output.push_str(rest);
    *value = output;
    replaced
}

#[cfg(test)]
#[path = "_tests_/asset_tokens_tests.rs"]
mod asset_tokens_tests;
