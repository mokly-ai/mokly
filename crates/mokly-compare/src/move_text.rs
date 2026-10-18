//! Static author-visible page text for similarity, without CSS or browser evaluation.

use crate::material::Material;

pub(crate) fn page(nodes: &[Material]) -> Vec<String> {
    let mut text = String::new();
    walk(nodes, false, &mut text);
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect()
}

fn walk(nodes: &[Material], pre: bool, output: &mut String) {
    let mut pending: Vec<_> = nodes
        .iter()
        .rev()
        .map(|node| Step::Node(node, pre))
        .collect();
    while let Some(step) = pending.pop() {
        let (node, pre) = match step {
            Step::Node(node, pre) => (node, pre),
            Step::End(block, cell) => {
                if block {
                    output.push('\n');
                }
                if cell {
                    output.push(' ');
                }
                continue;
            }
        };
        match node {
            Material::Element(_, name, attributes, children) => {
                let name = name.as_str();
                if matches!(name, "head" | "script" | "style" | "template" | "noscript")
                    || attributes.iter().any(|(name, _)| name == "hidden")
                    || attributes
                        .iter()
                        .any(|(name, value)| name == "aria-hidden" && value == "true")
                {
                    continue;
                }
                let block = matches!(
                    name,
                    "address"
                        | "article"
                        | "aside"
                        | "blockquote"
                        | "br"
                        | "dd"
                        | "div"
                        | "dl"
                        | "dt"
                        | "fieldset"
                        | "figcaption"
                        | "figure"
                        | "footer"
                        | "form"
                        | "h1"
                        | "h2"
                        | "h3"
                        | "h4"
                        | "h5"
                        | "h6"
                        | "header"
                        | "hr"
                        | "li"
                        | "main"
                        | "nav"
                        | "ol"
                        | "p"
                        | "pre"
                        | "section"
                        | "table"
                        | "tr"
                        | "ul"
                );
                if block {
                    output.push('\n');
                }
                pending.push(Step::End(block, matches!(name, "td" | "th")));
                pending.extend(
                    children
                        .iter()
                        .rev()
                        .map(|node| Step::Node(node, pre || name == "pre")),
                );
            }
            Material::Text(text) if pre => output.push_str(text),
            Material::Text(text) => {
                for character in text.chars() {
                    if character.is_ascii_whitespace() {
                        if !output.ends_with([' ', '\n']) {
                            output.push(' ');
                        }
                    } else {
                        output.push(character);
                    }
                }
            }
            Material::Slot(_, children) => {
                pending.extend(children.iter().rev().map(|node| Step::Node(node, pre)))
            }
            _ => {}
        }
    }
}

enum Step<'a> {
    Node(&'a Material, bool),
    End(bool, bool),
}

#[cfg(test)]
#[path = "_tests_/move_text_tests.rs"]
mod move_text_tests;
