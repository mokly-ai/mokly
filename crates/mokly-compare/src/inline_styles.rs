//! Head style rules use the containing public document route as their evidence source.

use mokly_css::attribution::RuleObservation;
use mokly_css::inline_attribution;
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::match_document;
use mokly_css::syntax;
use mokly_graph::viewer_fonts;
use mokly_html::tree::{Node, RegionKind};
use mokly_model::namespace;

use crate::error::Result;
use crate::resource_memo::ResourceMemo;

/// Observe the changed ownerless head rules of one view. `sources` are the artifact
/// paths of the before and after documents, which differ for a moved entry, and
/// `route` is the evidence source of each observation.
pub(crate) fn compare(
    before: Option<&[Node]>,
    after: Option<&[Node]>,
    before_tree: Option<&MatchTree>,
    after_tree: Option<&MatchTree>,
    sources: [&str; 2],
    route: &str,
    memo: &dyn ResourceMemo,
) -> Result<Vec<RuleObservation>> {
    let mut left = String::new();
    let mut right = String::new();
    collect(before.unwrap_or_default(), false, &mut left);
    collect(after.unwrap_or_default(), false, &mut right);
    if left == right {
        return Ok(Vec::new());
    }
    let left = faces(&left, sources[0]);
    let right = faces(&right, sources[1]);
    if left == right {
        return Ok(Vec::new());
    }
    let diff = memo.inline_diff(left.as_bytes(), right.as_bytes())?;
    let matches = match_document(&diff, before_tree, after_tree);
    Ok(inline_attribution::observe(
        route,
        &matches,
        before_tree,
        after_tree,
    ))
}

/// Name each viewer face by its artifact path. A Markdown document names the
/// faces through the address of its own route, so its move to another depth
/// changes no rule.
fn faces(css: &str, source: &str) -> String {
    let mut named = css.to_owned();
    for reference in syntax::references(css).into_iter().rev() {
        if let Some(face) = viewer_fonts::face(source, &reference)
            && named.get(reference.start..reference.end).is_some()
        {
            named.replace_range(
                reference.start..reference.end,
                &format!("url(\"{}\")", namespace::viewer(face)),
            );
        }
    }
    named
}

fn collect(nodes: &[Node], head: bool, output: &mut String) {
    let mut pending: Vec<_> = nodes.iter().rev().map(|node| (node, head)).collect();
    while let Some((node, head)) = pending.pop() {
        match node {
            Node::Region { region, children }
                if !matches!(region.kind, RegionKind::Ignore { .. }) =>
            {
                pending.extend(children.iter().rev().map(|node| (node, head)))
            }
            Node::Element(element)
                if head
                    && element.name == "style"
                    && (element.style_attribution.is_some()
                        || element.style_owners.as_ref().is_none_or(Vec::is_empty)) =>
            {
                if let Some(records) = &element.style_attribution {
                    for record in records.iter().filter(|record| record.owners.is_empty()) {
                        output.push_str(&record.css);
                        output.push('\n');
                    }
                    continue;
                }
                for node in &element.children {
                    if let Node::Text(text) = node {
                        output.push_str(text);
                    }
                }
                output.push('\n');
            }
            Node::Element(element) if element.name != "template" => pending.extend(
                element
                    .children
                    .iter()
                    .rev()
                    .map(|node| (node, head || element.name == "head")),
            ),
            _ => {}
        }
    }
}

#[cfg(test)]
#[path = "_tests_/inline_styles_tests.rs"]
mod inline_styles_tests;
