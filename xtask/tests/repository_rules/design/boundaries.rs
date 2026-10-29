//! The marked boundary rules of the design stylesheets, their recorded
//! exemptions, and the contrast that a boundary reaches.

use std::collections::HashSet;

use regex::Regex;

use super::palette::{Tokens, contrast, design_palette};
use super::styles::{ColorReference, StyleRule, boundary_of, design_style_rules, fill_of};

/// Selectors that mark a control state. A boundary drawn only in one of
/// these states is the state's own indicator, so it carries the 3:1
/// requirement.
const STATE_SELECTOR: &str = r":hover|:focus|:checked|:has\(input:checked\)|:disabled|\[open\]|\.active|aria-pressed|aria-current";

/// Boundaries the palette contract exempts from 3:1, each with the reason
/// that exempts it, so a new entry has to state why rather than join a list.
pub(crate) const DECORATIVE_BOUNDARIES: [(&str, &str); 5] = [
    (".ce-added", "a label naming its own state in 7.08:1 ink"),
    (".ce-changed", "a label naming its own state in 5.62:1 ink"),
    (".ce-removed", "a label naming its own state in 5.73:1 ink"),
    (
        ".ce-control-alert",
        "a label naming its own state in 5.97:1 ink",
    ),
    (".ce-action:disabled", "WCAG exempts a disabled control"),
];

/// Surfaces that draw a hairline inside a state selector because the state
/// belongs to a descendant, not to a control. Each entry must be reached by
/// the audit, so a future control cannot quietly inherit the exemption.
pub(crate) const EXEMPT_SURFACES: [(&str, &str); 1] = [(
    "design-library/inspector/inspector.css",
    ".ce-design .mbk-shell--mobile .ce-inspector:has(> details[open])",
)];

/// A rule whose boundary is a control or state indicator.
pub(crate) struct MarkedRule {
    /// The rule.
    pub(crate) rule: StyleRule,
    /// The colour of the boundary that the rule draws.
    pub(crate) boundary: ColorReference,
    /// The colour of the fill behind the boundary.
    pub(crate) fill: Option<ColorReference>,
}

/// Rules whose boundary is a control or state indicator: either the selector
/// names a state, or the rule fills itself with a marked surface.
pub(crate) fn marked_boundary_rules() -> Vec<MarkedRule> {
    let palette = design_palette();
    let state = Regex::new(STATE_SELECTOR).unwrap();
    let mut marked: HashSet<String> = HashSet::new();
    for token in marked_fill_tokens(&palette.light) {
        marked.insert(token.to_owned());
        for tokens in [&palette.light, &palette.dark] {
            let value = tokens
                .get(token)
                .map_or(token.to_owned(), str::to_lowercase);
            marked.insert(value);
        }
    }
    design_style_rules()
        .into_iter()
        .filter_map(|rule| {
            let boundary = boundary_of(&rule.body)?;
            let fill = fill_of(&rule.body);
            let fill_mark = match &fill {
                Some(ColorReference::Token(token)) => Some(token.clone()),
                Some(ColorReference::Literal(literal)) => Some(literal.to_lowercase()),
                None => None,
            };
            let marked_fill = fill_mark.is_some_and(|mark| marked.contains(&mark));
            if !state.is_match(&rule.selector) && !marked_fill {
                return None;
            }
            Some(MarkedRule {
                rule,
                boundary,
                fill,
            })
        })
        .collect()
}

/// Whether the selector is a recorded decorative boundary.
pub(crate) fn is_decorative(selector: &str) -> bool {
    DECORATIVE_BOUNDARIES
        .iter()
        .any(|(decorative, _)| *decorative == selector)
}

/// Whether the rule is a recorded exempt surface.
pub(crate) fn is_exempt_surface(rule: &StyleRule) -> bool {
    EXEMPT_SURFACES
        .iter()
        .any(|(file, selector)| *file == rule.file && *selector == rule.selector)
}

/// A boundary sits between its own fill and the surface around it, so it
/// only has to reach 3:1 against one of them to read as an edge. None when
/// the boundary colour is not in the palette.
pub(crate) fn boundary_contrast(
    boundary: &ColorReference,
    fill: Option<&ColorReference>,
    tokens: &Tokens,
) -> Option<f64> {
    let edge = resolve(boundary, tokens)?;
    let behind = fill
        .and_then(|fill| resolve(fill, tokens))
        .map_or(0.0, |behind| contrast(edge, behind));
    let surface = tokens
        .get("--chrome-surface")
        .expect("the palette has --chrome-surface");
    Some(behind.max(contrast(edge, surface)))
}

/// Fills that mark a selected, active, or status surface, derived from the
/// palette so a new accent or status role joins the audit without an edit.
fn marked_fill_tokens(tokens: &Tokens) -> Vec<&str> {
    tokens
        .names()
        .filter(|token| {
            token.starts_with("--mbk-accent-")
                || *token == "--mbk-danger-bg"
                || *token == "--chrome-disabled-bg"
                || (token.starts_with("--mbk-status-") && token.ends_with("-bg"))
        })
        .collect()
}

/// The colour a reference paints in one appearance.
fn resolve<'a>(reference: &'a ColorReference, tokens: &'a Tokens) -> Option<&'a str> {
    match reference {
        ColorReference::Token(token) => tokens.get(token),
        ColorReference::Literal(literal) => Some(literal.as_str()),
    }
    .filter(|colour| !colour.is_empty())
}
