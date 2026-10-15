//! Static link-control root validation and adaptation.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::catalogue::SourceLocation;

use crate::control_tiers::{ancestor, descendant};
use crate::error::{Result, invalid};
use crate::tree::{Element, Node, element};
use crate::{control_tiers, error};

/// Adapt every marked control after composition; return route-scoped warnings.
pub fn adapt(nodes: &mut [Node], route: &str) -> Result<Vec<Warning>> {
    let mut warnings = Vec::new();
    let active = match walk(nodes, &[], false, route, &mut warnings) {
        Ok(active) => active,
        Err(source) => {
            return Err(error::HtmlError::Attempt {
                source: Box::new(error::HtmlError::Route {
                    route: route.into(),
                    source: Box::new(source),
                }),
                warnings,
            });
        }
    };
    if active {
        add_style(nodes);
    }
    Ok(warnings)
}

fn walk(
    nodes: &mut [Node],
    ancestors: &[Element],
    inherited: bool,
    route: &str,
    warnings: &mut Vec<Warning>,
) -> Result<bool> {
    let mut active = false;
    for node in nodes {
        match node {
            Node::Region { children, .. } => {
                active |= walk(children, ancestors, inherited, route, warnings)?
            }
            Node::Element(root) => {
                if root
                    .attributes
                    .iter()
                    .any(|a| a.name.starts_with("data-mokly-link-control"))
                {
                    return Err(invalid(
                        "html-attribute",
                        "data-mokly-link-control attributes are reserved",
                    ));
                }
                let inactive = inherited
                    || root.get("inert").is_some()
                    || root.get("aria-disabled") == Some("true")
                    || root.get("aria-busy") == Some("true")
                    || (root.name == "fieldset" && root.get("disabled").is_some());
                if let Some(target) = root.take("to") {
                    let fragment = root.take("fragment");
                    if target.contains(['#', '%', '?', ':'])
                        || fragment.as_ref().is_some_and(|v| v.contains(['#', '%']))
                    {
                        return Err(invalid(
                            "html-attribute",
                            "MockLink destination and fragment must be separate unencoded values",
                        ));
                    }
                    let logical = format!(
                        "mock:{target}{}",
                        fragment.map_or(String::new(), |fragment| format!("#{fragment}"))
                    );
                    located(
                        check_ancestors(ancestors, route, warnings),
                        root.source.clone(),
                    )?;
                    located(check_root(root, &logical), root.source.clone())?;
                    located(
                        check_descendants(&root.children, route, warnings),
                        root.source.clone(),
                    )?;
                    let tag = root.name.clone();
                    if inactive || root.get("disabled").is_some() {
                        root.take("href");
                        root.set("data-nav-href", logical);
                        if tag == "button" {
                            root.set("type", "button");
                        }
                    } else {
                        root.name = "a".into();
                        root.set("href", logical);
                        if matches!(root.get("role"), Some("button")) {
                            root.take("role");
                        }
                        for name in [
                            "type",
                            "disabled",
                            "form",
                            "formaction",
                            "formenctype",
                            "formmethod",
                            "formnovalidate",
                            "formtarget",
                            "name",
                            "value",
                        ] {
                            if tag == "button" {
                                root.take(name);
                            }
                        }
                        root.set("data-mokly-link-control", tag);
                        active = true;
                    }
                }
                let mut parents = ancestors.to_vec();
                let mut parent = root.clone();
                parent.children.clear();
                parents.push(parent);
                active |= walk(&mut root.children, &parents, inactive, route, warnings)?;
            }
            _ => {}
        }
    }
    Ok(active)
}

fn check_root(root: &Element, logical: &str) -> Result<()> {
    if !root.is_html()
        || !matches!(root.name.as_str(), "a" | "button" | "div" | "span")
        || root.get("contenteditable").is_some_and(|s| s != "false")
        || root
            .get("role")
            .is_some_and(|r| !matches!(r, "button" | "link"))
        || root.attributes.iter().any(|a| a.name.starts_with("on"))
    {
        return Err(invalid(
            "html-attribute",
            format!(
                "MockLink child control has an unsupported root <{}>",
                root.name
            ),
        ));
    }
    if ["href", "data-nav-href"].iter().any(|name| {
        root.get(name)
            .is_some_and(|value| !same_logical(value, logical))
    }) {
        return Err(invalid(
            "html-attribute",
            "MockLink child control has conflicting destinations",
        ));
    }
    Ok(())
}

fn check_ancestors(ancestors: &[Element], route: &str, warnings: &mut Vec<Warning>) -> Result<()> {
    let tiers: Vec<_> = ancestors
        .iter()
        .rev()
        .filter_map(|element| ancestor(element).map(|tier| (element, tier)))
        .collect();
    if let Some((_, tier)) = tiers.iter().find(|(_, tier)| tier.error) {
        return Err(invalid(
            "html-attribute",
            format!(
                "MockLink child control is inside {}; move the control outside it",
                tier.feature
            ),
        ));
    }
    if let Some((_, tier)) = tiers.first() {
        warnings.push(Warning {
            code: "link-control-ancestor",
            subject: WarningSubject::Route(route.into()),
            message: format!(
                "MockLink child control is inside {}; one click or key press has two targets",
                tier.feature
            ),
        });
    }
    Ok(())
}

fn check_descendants(nodes: &[Node], route: &str, warnings: &mut Vec<Warning>) -> Result<()> {
    let mut tiers = Vec::new();
    collect(nodes, &mut tiers);
    if let Some(tier) = tiers.iter().find(|tier| tier.error) {
        return Err(invalid(
            "html-attribute",
            format!(
                "MockLink child control contains {}; {}",
                tier.feature, tier.reason
            ),
        ));
    }
    if let Some(tier) = tiers.first() {
        warnings.push(Warning {
            code: "link-control-descendant",
            subject: WarningSubject::Route(route.into()),
            message: format!(
                "MockLink child control contains {}; {}",
                tier.feature, tier.reason
            ),
        });
    }
    Ok(())
}

fn collect(nodes: &[Node], tiers: &mut Vec<control_tiers::Tier>) {
    for node in nodes {
        match node {
            Node::Element(element) => {
                if element.get("to").is_some() {
                    tiers.push(control_tiers::Tier {
                        error: true,
                        feature: format!("<{}>", element.name),
                        reason: "remove the nested interactive element",
                    });
                } else if let Some(tier) = descendant(element) {
                    tiers.push(tier);
                }
                collect(&element.children, tiers);
            }
            Node::Region { children, .. } => collect(children, tiers),
            _ => {}
        }
    }
}

fn add_style(nodes: &mut [Node]) {
    for node in nodes {
        if let Node::Element(root) = node {
            if root.name == "head" {
                root.children
                    .push(element("style", &[], vec![Node::Text(CONTROL_CSS.into())]));
            } else {
                add_style(&mut root.children);
            }
        }
    }
}

const CONTROL_CSS: &str = ":where(a[data-mokly-link-control]){color:inherit;text-decoration:inherit;cursor:pointer}:where(a[data-mokly-link-control=button]){display:inline-block;width:fit-content}:where(a[data-mokly-link-control=div]){display:block}:where(a[data-mokly-link-control=span],a[data-mokly-link-control=a]){display:inline}a[data-mokly-link-control]:focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important}";

fn located<T>(result: Result<T>, location: Option<SourceLocation>) -> Result<T> {
    match (result, location) {
        (Err(source), Some(location)) => Err(error::HtmlError::Located {
            source: Box::new(source),
            location,
        }),
        (result, _) => result,
    }
}

fn same_logical(left: &str, right: &str) -> bool {
    let Some(left) = left.strip_prefix("mock:") else {
        return false;
    };
    let Some(right) = right.strip_prefix("mock:") else {
        return false;
    };
    let (left, left_fragment) = left
        .split_once('#')
        .map_or((left, None), |(path, fragment)| (path, Some(fragment)));
    let (right, right_fragment) = right
        .split_once('#')
        .map_or((right, None), |(path, fragment)| (path, Some(fragment)));
    left.eq_ignore_ascii_case(right) && left_fragment == right_fragment
}
