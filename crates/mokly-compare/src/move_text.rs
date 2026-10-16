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
    for node in nodes {
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
                walk(children, pre || name == "pre", output);
                if block {
                    output.push('\n');
                }
                if matches!(name, "td" | "th") {
                    output.push(' ');
                }
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
            Material::Slot(_, children) => walk(children, pre, output),
            _ => {}
        }
    }
}
