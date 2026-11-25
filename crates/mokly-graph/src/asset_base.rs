//! Check rewritten asset destinations against each document's effective base.

use mokly_html::tree::Node;
use mokly_model::review_affected::ReviewSide;
use mokly_model::{namespace, routes};
use url::Url;

use crate::error::{Result, invalid};

/// The base and rewritten URLs of one document in an outer tree and its frames.
#[derive(Default)]
pub(crate) struct DocumentAssets {
    /// Index of the enclosing document, which comes before this one.
    pub(crate) parent: Option<usize>,
    /// Value of the first HTML base href, if present.
    pub(crate) base: Option<String>,
    /// Document-relative URLs written during token replacement.
    pub(crate) urls: Vec<String>,
}

/// Find the first HTML base with an href outside template contents.
pub(crate) fn first_base_href(nodes: &[Node]) -> Option<&str> {
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

/// Validate the destinations at both live and snapshot addresses on two origins.
pub(crate) fn validate(documents: &[DocumentAssets], route: &str) -> Result<()> {
    if documents.iter().all(|document| document.base.is_none()) {
        return Ok(());
    }
    let encoded = routes::encode(route);
    let snapshot = routes::comparison_snapshot(
        ReviewSide::After,
        &format!("{}/{encoded}", namespace::GENERATED_DIRECTORY),
    );
    let paths = [
        namespace::generated(&encoded),
        format!("{}{snapshot}", routes::comparison_generation("1")),
    ];
    for origin in ["https://mokly.invalid/", "http://other.mokly.invalid/"]
        .into_iter()
        .filter_map(|origin| Url::parse(origin).ok())
    {
        for path in &paths {
            if let Ok(address) = origin.join(path) {
                validate_at(address, documents, route)?;
            }
        }
    }
    Ok(())
}

fn validate_at(address: Url, documents: &[DocumentAssets], route: &str) -> Result<()> {
    let mut bases = Vec::with_capacity(documents.len());
    for document in documents {
        let inherited = document.parent.map_or(&address, |parent| &bases[parent]);
        let base = document
            .base
            .as_deref()
            .and_then(|href| inherited.join(href).ok())
            .filter(|url| !matches!(url.scheme(), "data" | "javascript"))
            .unwrap_or_else(|| inherited.clone());
        for reference in &document.urls {
            let Ok(expected) = address.join(reference) else {
                continue;
            };
            let destination = base.join(reference).ok();
            if !same_destination(Some(&expected), destination.as_ref()) {
                let reason = redirect_reason(
                    documents,
                    &bases,
                    document.parent,
                    reference,
                    destination.as_ref(),
                );
                return Err(invalid(route, format!("{route}: {reason}")));
            }
        }
        bases.push(base);
    }
    Ok(())
}

/// Attribute the redirect to the nearest base that changed this URL's destination.
fn redirect_reason(
    documents: &[DocumentAssets],
    bases: &[Url],
    mut parent: Option<usize>,
    reference: &str,
    destination: Option<&Url>,
) -> &'static str {
    while let Some(index) = parent {
        let inherited = bases[index].join(reference).ok();
        if !same_destination(inherited.as_ref(), destination) {
            return "<base href> in an <iframe srcdoc> document redirects its imported asset URLs; remove <base href>";
        }
        parent = documents[index].parent;
    }
    "<base href> redirects the imported asset URLs of this document; remove <base href>"
}

fn same_destination(left: Option<&Url>, right: Option<&Url>) -> bool {
    match (left, right) {
        (Some(left), Some(right)) => {
            left == right || (left.origin() == right.origin() && left.path() == right.path())
        }
        (None, None) => true,
        _ => false,
    }
}
