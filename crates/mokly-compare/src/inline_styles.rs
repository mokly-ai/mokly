//! Head style rules use the containing public document route as their evidence source.

use mokly_css::inline_attribution::{self, InlineAttribution};
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_matching::match_document;
use mokly_html::tree::{Node, RegionKind};

use crate::error::Result;
use crate::resource_memo::ResourceMemo;

pub(crate) fn compare(
    before: Option<&[Node]>,
    after: Option<&[Node]>,
    before_tree: Option<&MatchTree>,
    after_tree: Option<&MatchTree>,
    route: &str,
    memo: &dyn ResourceMemo,
) -> Result<InlineAttribution> {
    let mut left = String::new();
    let mut right = String::new();
    collect(before.unwrap_or_default(), &mut left);
    collect(after.unwrap_or_default(), &mut right);
    if left == right {
        return Ok(InlineAttribution::default());
    }
    let diff = memo.inline_diff(left.as_bytes(), right.as_bytes())?;
    let matches = match_document(&diff, before_tree, after_tree);
    Ok(inline_attribution::attribute(
        route,
        &matches,
        before_tree,
        after_tree,
    ))
}

fn collect(nodes: &[Node], output: &mut String) {
    for node in nodes {
        match node {
            Node::Region { region, children }
                if !matches!(region.kind, RegionKind::Ignore { .. }) =>
            {
                collect(children, output)
            }
            Node::Element(element) if element.name == "style" => {
                for node in &element.children {
                    if let Node::Text(text) = node {
                        output.push_str(text);
                    }
                }
                output.push('\n');
            }
            Node::Element(element) if element.name != "template" => {
                collect(&element.children, output)
            }
            _ => {}
        }
    }
}
