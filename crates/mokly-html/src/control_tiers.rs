//! Accessible placement tiers for catalogue controls.

use crate::tree::Element;

pub(crate) struct Tier {
    pub(crate) error: bool,
    pub(crate) feature: String,
    pub(crate) reason: &'static str,
}

const INTERACTIVE_ROLES: &[&str] = &[
    "button",
    "link",
    "checkbox",
    "combobox",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "searchbox",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
    "treeitem",
];
const STRUCTURAL_ROLES: &[&str] = &[
    "gridcell",
    "listbox",
    "menu",
    "menubar",
    "radiogroup",
    "tablist",
    "tree",
    "treegrid",
];

pub(crate) fn ancestor(element: &Element) -> Option<Tier> {
    if matches!(element.name.as_str(), "a" | "area") {
        return Some(tier(element, true, None, ""));
    }
    if editable(element) {
        return Some(tier(element, true, Some("contenteditable"), ""));
    }
    if matches!(
        element.name.as_str(),
        "button" | "label" | "summary" | "object"
    ) {
        return Some(tier(element, false, None, ""));
    }
    if media(element) {
        return Some(tier(element, false, Some("controls"), ""));
    }
    if role(element, INTERACTIVE_ROLES) {
        return Some(tier(element, false, Some("role"), ""));
    }
    None
}

pub(crate) fn descendant(element: &Element) -> Option<Tier> {
    if matches!(
        element.name.as_str(),
        "a" | "area"
            | "button"
            | "input"
            | "select"
            | "textarea"
            | "summary"
            | "details"
            | "label"
            | "iframe"
            | "object"
            | "embed"
    ) {
        return Some(tier(
            element,
            true,
            None,
            "remove the nested interactive element",
        ));
    }
    if editable(element) {
        return Some(tier(
            element,
            true,
            Some("contenteditable"),
            "remove the nested interactive element",
        ));
    }
    if media(element) {
        return Some(tier(
            element,
            true,
            Some("controls"),
            "remove the nested interactive element",
        ));
    }
    if role(element, INTERACTIVE_ROLES) {
        return Some(tier(
            element,
            true,
            Some("role"),
            "remove the nested interactive element",
        ));
    }
    if let Some(attribute) = element.attributes.iter().find(|a| a.name.starts_with("on")) {
        return Some(tier(
            element,
            true,
            Some(&attribute.name),
            "remove the inline event handler",
        ));
    }
    if role(element, STRUCTURAL_ROLES) {
        return Some(tier(
            element,
            false,
            Some("role"),
            "the role does not belong inside a link",
        ));
    }
    if element.get("tabindex").is_some() {
        return Some(tier(
            element,
            false,
            Some("tabindex"),
            "the link has an extra focus stop",
        ));
    }
    None
}

fn editable(element: &Element) -> bool {
    element
        .get("contenteditable")
        .is_some_and(|value| value != "false")
}
fn media(element: &Element) -> bool {
    matches!(element.name.as_str(), "audio" | "video") && element.get("controls").is_some()
}
fn role(element: &Element, roles: &[&str]) -> bool {
    element.get("role").is_some_and(|value| {
        value
            .split_ascii_whitespace()
            .any(|role| roles.contains(&role))
    })
}

fn tier(element: &Element, error: bool, attribute: Option<&str>, reason: &'static str) -> Tier {
    let feature = match attribute {
        None => format!("<{}>", element.name),
        Some(name) if name.starts_with("on") => format!("<{} {name}>", element.name),
        Some(name) => {
            let value = element
                .get(name)
                .unwrap_or("")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            let value: String = value
                .chars()
                .map(|c| {
                    if c.is_control() {
                        format!("\\u{:04x}", u32::from(c))
                    } else if c == '"' {
                        "&quot;".into()
                    } else {
                        c.to_string()
                    }
                })
                .collect();
            format!("<{} {name}=\"{value}\">", element.name)
        }
    };
    Tier {
        error,
        feature,
        reason,
    }
}
