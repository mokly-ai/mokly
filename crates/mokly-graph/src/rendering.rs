//! Final composition, link rewriting, Markdown safety, and document bytes.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::composition::Composed;
use mokly_html::markdown::LinkResolver;
use mokly_html::tree::Node;
use mokly_html::{controls, links, markdown, safety, serialize};
use mokly_model::axes::Viewport;
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::usage::CatalogueUsage;

use crate::cache::Artifact;
use crate::error::{GraphError, Result};
use crate::types::DocumentPlan;
use crate::{error, references, urls};

pub(crate) fn markdown(
    catalogue: &PreparedCatalogue,
    entry: &ModelEntry,
    plan: &DocumentPlan,
    resolver: &dyn LinkResolver,
) -> Result<Composed> {
    let body = catalogue
        .documents
        .get(&entry.metadata.path)
        .map_or("", String::as_str);
    let tree = match markdown::render(body, &entry.metadata.title, plan.color_scheme, resolver) {
        Ok(tree) => tree,
        Err(source) => return Err(GraphError::Html { source }),
    };
    Ok(Composed {
        tree,
        usage: CatalogueUsage::Ready {
            instances: Vec::new(),
            slots: Vec::new(),
            ranges: Vec::new(),
        },
        warnings: Vec::new(),
        resources: Vec::new(),
        components: Vec::new(),
        links: Vec::new(),
    })
}

pub(crate) fn finish(
    mut document: Composed,
    plan: &DocumentPlan,
    entry: &ModelEntry,
    entries: &[ModelEntry],
) -> Result<Arc<Artifact>> {
    if let Err(source) = validate(&mut document, plan, entry, entries) {
        return Err(GraphError::Attempt {
            failures: vec![source],
            warnings: document.warnings,
        });
    }
    let bytes = serialize::html(&document.tree).into_bytes();
    Ok(Arc::new(Artifact {
        bytes,
        document: Some(document),
        fragment: None,
        content_type: "text/html; charset=utf-8".into(),
    }))
}

fn check_anchors(nodes: &[Node], anchors: &BTreeSet<String>, route: &str) -> Result<()> {
    for node in nodes {
        match node {
            Node::Element(element) => {
                for attribute in ["href", "data-nav-href"] {
                    if let Some(fragment) = element
                        .get(attribute)
                        .and_then(|url| url.strip_prefix('#'))
                        .filter(|fragment| !fragment.is_empty())
                    {
                        let fragment = match urls::decode_fragment(fragment) {
                            Ok(fragment) => fragment,
                            Err(source) => {
                                return Err(error::invalid(route, format!("{route}: {source}")));
                            }
                        };
                        if !anchors.contains(&fragment) {
                            return Err(error::invalid(
                                route,
                                format!("{route}: missing anchor {fragment:?}"),
                            ));
                        }
                    }
                }
                check_anchors(&element.children, anchors, route)?;
            }
            Node::Region { children, .. } => check_anchors(children, anchors, route)?,
            _ => {}
        }
    }
    Ok(())
}

fn validate(
    document: &mut Composed,
    plan: &DocumentPlan,
    entry: &ModelEntry,
    entries: &[ModelEntry],
) -> Result<()> {
    match controls::adapt(&mut document.tree, &plan.route) {
        Ok(warnings) => document.warnings.extend(warnings),
        Err(source) => return Err(GraphError::Html { source }),
    }
    document.links = match links::rewrite(
        &mut document.tree,
        entries,
        entry,
        &plan.route,
        plan.viewport.unwrap_or(Viewport::Desktop),
        plan.color_scheme,
    ) {
        Ok(links) => links,
        Err(source) => return Err(GraphError::Html { source }),
    };
    if matches!(entry.content, EntryContent::Document { .. })
        && let Err(source) = safety::validate(&document.tree)
    {
        return Err(GraphError::Html { source });
    }
    check_anchors(
        &document.tree,
        &references::anchors(&document.tree),
        &plan.route,
    )?;
    Ok(())
}
