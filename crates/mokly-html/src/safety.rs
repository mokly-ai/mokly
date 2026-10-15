//! Independent final allowlist for composed Markdown documents.

use serde_json::Value;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Element, Node};
use crate::{error, markdown};

/// Validate the whole parsed document, including wrappers and its owned stylesheet.
pub fn validate(nodes: &[Node]) -> Result<()> {
    let mut styles = 0;
    for node in nodes {
        match node {
            Node::Doctype(_) | Node::Comment(_) => {}
            Node::Text(text) if text.trim().is_empty() => {}
            Node::Element(html) if html.name == "html" && html.is_html() => {
                attributes(html, |name, value| {
                    (name == "lang" && value == "en")
                        || (name == "style"
                            && matches!(value, "color-scheme: light" | "color-scheme: dark"))
                })?;
                for node in &html.children {
                    let Node::Element(element) = node else {
                        continue;
                    };
                    if element.name == "head" {
                        attributes(element, |_, _| false)?;
                        head(&element.children, &mut styles)?;
                    } else if element.name == "body" {
                        attributes(element, |_, _| false)?;
                        body(&element.children, true)?;
                    } else {
                        return Err(element_error(element));
                    }
                }
            }
            Node::Element(element) => return Err(element_error(element)),
            _ => {
                return Err(invalid(
                    Code::BuildInvalid,
                    "unsafe rendered document: invalid outer structure",
                ));
            }
        }
    }
    if styles != 1 {
        return Err(invalid(
            Code::BuildInvalid,
            "unsafe rendered document: the template must contain one owned stylesheet",
        ));
    }
    Ok(())
}

fn head(nodes: &[Node], styles: &mut usize) -> Result<()> {
    for node in nodes {
        if let Node::Element(element) = node {
            match element.name.as_str() {
                "title" | "style" => {
                    attributes(element, |_, _| false)?;
                    if element.name == "style" {
                        if !matches!(element.children.as_slice(), [Node::Text(css)] if css == markdown::STYLES)
                        {
                            return Err(invalid(
                                Code::BuildInvalid,
                                "unsafe rendered document: the template must contain one owned stylesheet",
                            ));
                        }
                        *styles += 1;
                    }
                }
                "meta" => attributes(element, |name, value| {
                    (name == "charset" && value == "utf-8")
                        || (name == "name" && value == "viewport")
                        || (name == "content" && value == "width=device-width, initial-scale=1")
                })?,
                _ => return Err(element_error(element)),
            }
        }
    }
    Ok(())
}

fn body(nodes: &[Node], direct: bool) -> Result<()> {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        if !element.is_html() {
            return Err(element_error(element));
        }
        match element.name.as_str() {
            "main" if direct => attributes(element, |_, _| false)?,
            "p" | "blockquote" | "ul" | "li" | "hr" | "pre" | "em" | "strong" | "del" | "table"
            | "thead" | "tbody" | "tr" | "br" => attributes(element, |_, _| false)?,
            "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => attributes(element, |name, value| {
                name == "id"
                    && !value.is_empty()
                    && value
                        .chars()
                        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
            })?,
            "code" => attributes(element, |name, value| {
                name == "class" && value.starts_with("language-") && value.len() > 9
            })?,
            "ol" => attributes(element, |name, value| {
                name == "start"
                    && (1..=9).contains(&value.len())
                    && value.bytes().all(|c| c.is_ascii_digit())
            })?,
            "a" => {
                attributes(element, |name, _| {
                    matches!(name, "href" | "title" | "data-mokly-link")
                })?;
                if element.get("data-mokly-link").is_some() && element.navigation.is_none() {
                    return Err(invalid(
                        Code::BuildInvalid,
                        "unsafe rendered document: attribute data-mokly-link on <a> is not allowed",
                    ));
                }
                url_attribute(element, "href")?;
            }
            "img" => {
                attributes(element, |name, _| matches!(name, "src" | "alt" | "title"))?;
                url_attribute(element, "src")?;
            }
            "th" | "td" => attributes(element, |name, value| {
                name == "align" && matches!(value, "left" | "center" | "right")
            })?,
            "input" => {
                attributes(element, |name, value| {
                    ((name == "checked" || name == "disabled") && value.is_empty())
                        || (name == "type" && value == "checkbox")
                })?;
                if element.get("disabled").is_none() {
                    return Err(invalid(
                        Code::BuildInvalid,
                        "unsafe rendered document: <input> must be disabled",
                    ));
                }
                if element.get("type") != Some("checkbox") {
                    return Err(invalid(
                        Code::BuildInvalid,
                        "unsafe rendered document: <input> must have checkbox type",
                    ));
                }
            }
            _ => return Err(element_error(element)),
        }
        body(&element.children, false)?;
    }
    Ok(())
}

fn attributes(element: &Element, permit: impl Fn(&str, &str) -> bool) -> Result<()> {
    for attribute in &element.attributes {
        if !permit(&attribute.name, &attribute.value) {
            return Err(invalid(
                Code::BuildInvalid,
                format!(
                    "unsafe rendered document: attribute {} on <{}> is not allowed",
                    attribute.name, element.name
                ),
            ));
        }
    }
    Ok(())
}

fn url_attribute(element: &Element, name: &str) -> Result<()> {
    if let Some(url) = element.get(name) {
        let lower = url.to_ascii_lowercase();
        if url.trim() != url
            || url.starts_with('/')
            || url.contains('\\')
            || url.chars().any(char::is_control)
            || (url.contains(':')
                && !["http:", "https:", "mailto:"]
                    .iter()
                    .any(|scheme| lower.starts_with(scheme)))
        {
            return Err(invalid(
                Code::BuildInvalid,
                format!(
                    "unsafe rendered document: {name} on <{}> is not an allowed URL: {}",
                    element.name,
                    Value::String(url.into())
                ),
            ));
        }
    }
    Ok(())
}

fn element_error(element: &Element) -> error::HtmlError {
    invalid(
        Code::BuildInvalid,
        format!(
            "unsafe rendered document: element <{}> is not allowed",
            element.name
        ),
    )
}
