//! Marked boundaries and control edges stay visible, and only palette
//! sources name colours.

use std::collections::HashMap;

use regex::Regex;

use super::boundaries::{
    DECORATIVE_BOUNDARIES, EXEMPT_SURFACES, boundary_contrast, is_decorative, is_exempt_surface,
    marked_boundary_rules,
};
use super::palette::design_palette;
use super::styles::{ColorReference, boundary_of, design_style_rules, fill_of};

/// Selectors naming a control primitive, whose boundary is a control edge.
const CONTROL_SELECTOR: &str = r"\bbutton\b|\binput\b|\bselect\b|\bsummary\b|\btextarea\b|\.ce-action|\.ce-button|\.ce-icon-control|\.mbk-seg|\.mbk-appearance|\.ce-sheet-expand|\.mbk-chip:is\(a\)";

/// Tokens the palette contract reserves for decoration between surfaces.
const HAIRLINE_TOKENS: [&str; 3] = ["--chrome-border", "--chrome-border-strong", "--mbk-guide"];

/// Every rule the audit collects, so a failure names the rule that appeared
/// or vanished instead of only reporting that the total moved.
const AUDITED_BOUNDARIES: [&str; 22] = [
    "design-component-controls.css .ce-action--quiet",
    "design-component-controls.css .ce-control-alert",
    r#"design-component-inspection.css .ce-button[aria-pressed="true"]"#,
    "design-components.css .ce-action:disabled",
    "design-components.css .ce-badge",
    "design-components.css .ce-design a:focus-visible, .ce-design button:focus-visible, .ce-design summary:focus-visible, .ce-design input:focus-visible, .ce-design select:focus-visible",
    "design-components.css .ce-variants a[aria-current]",
    "design-library/chrome/appearance-selector.css .mbk-appearance:focus-within",
    "design-library/chrome/appearance-selector.css .mbk-appearance:hover",
    "design-library/chrome/catalogue-navigation.css .mbk-nav-variants-toggle:focus-visible",
    "design-library/controls/change-status.css .ce-added",
    "design-library/controls/change-status.css .ce-changed",
    "design-library/controls/change-status.css .ce-removed",
    "design-library/controls/comparison-toolbar.css .mbk-cmp-sync:has(input:checked) .mbk-cmp-sync-track",
    "design-library/controls/comparison-toolbar.css .mbk-cmp-sync:has(input:focus-visible) .mbk-cmp-sync-track",
    "design-library/controls/tag-chip.css .mbk-chip.tag:is(a).active",
    "design-library/controls/view-controls.css .ce-icon-control:focus-within",
    "design-library/controls/view-controls.css .ce-icon-control:hover, .ce-icon-control:has(input:checked)",
    "design-library/inspector/inspector.css .ce-design .mbk-shell--mobile .ce-inspector:has(> details[open])",
    "design-library/inspector/inspector.css .ce-inspector > details[open] > summary",
    "design-library/inspector/inspector.css .ce-sheet-expand:focus-visible",
    "design-stage.css .mbk-chip:is(a):focus-visible",
];

/// Sheets that define a palette, where a literal is the definition itself:
/// the interface palette, the preview palette with its fixed device
/// hardware, and the component explorer's scoped palette for depicted content.
const PALETTE_SOURCES: [&str; 3] = [
    "design.css",
    "design-stage.css",
    "design-component-view.css",
];

#[test]
fn every_marked_boundary_is_visible_against_an_adjacent_colour() {
    let palette = design_palette();
    let rules = marked_boundary_rules();
    let mut audited: Vec<String> = rules
        .iter()
        .map(|marked| format!("{} {}", marked.rule.file, marked.rule.selector))
        .collect();
    audited.sort();
    let mut expected = AUDITED_BOUNDARIES.to_vec();
    expected.sort_unstable();
    assert_eq!(
        audited, expected,
        "the audit's coverage changed; confirm every added or removed rule is intended"
    );
    for (selector, reason) in DECORATIVE_BOUNDARIES {
        assert!(
            rules.iter().any(|marked| marked.rule.selector == selector),
            "the recorded exception {selector} ({reason}) is not reached by the audit"
        );
    }
    for (file, selector) in EXEMPT_SURFACES {
        assert!(
            rules
                .iter()
                .any(|marked| marked.rule.file == file && marked.rule.selector == selector),
            "the exempt surface {file} {selector} is not reached by the audit"
        );
    }
    let mut failures = Vec::new();
    for marked in &rules {
        let rule = &marked.rule;
        if is_decorative(&rule.selector) || is_exempt_surface(rule) {
            continue;
        }
        let boundary = marked.boundary.describe();
        for (appearance, tokens) in palette.appearances() {
            let reached = boundary_contrast(&marked.boundary, marked.fill.as_ref(), tokens)
                .unwrap_or_else(|| {
                    panic!(
                        "{} {}: {boundary} is not in the {appearance} palette",
                        rule.file, rule.selector
                    )
                });
            if reached < 3.0 {
                failures.push(format!(
                    "{} {}: {boundary} reaches only {reached}:1 in {appearance}",
                    rule.file, rule.selector
                ));
            }
        }
    }
    assert_eq!(failures, Vec::<String>::new());
}

#[test]
fn every_control_boundary_is_a_readable_control_edge() {
    let palette = design_palette();
    let control = Regex::new(CONTROL_SELECTOR).unwrap();
    let mut failures = Vec::new();
    for rule in design_style_rules() {
        if !control.is_match(&rule.selector) || is_decorative(&rule.selector) {
            continue;
        }
        let Some(boundary) = boundary_of(&rule.body) else {
            continue;
        };
        let shown = format!("{} {}: {}", rule.file, rule.selector, boundary.describe());
        if let ColorReference::Token(token) = &boundary
            && HAIRLINE_TOKENS.contains(&token.as_str())
        {
            failures.push(format!(
                "{shown} is a decorative hairline; a control uses --chrome-control-edge or --mbk-sage-deep"
            ));
            continue;
        }
        let fill = fill_of(&rule.body);
        for (appearance, tokens) in palette.appearances() {
            match boundary_contrast(&boundary, fill.as_ref(), tokens) {
                None => failures.push(format!("{shown} is not in the {appearance} palette")),
                Some(reached) if reached < 3.0 => {
                    failures.push(format!("{shown} reaches only {reached}:1 in {appearance}"));
                }
                Some(_) => {}
            }
        }
    }
    assert_eq!(failures, Vec::<String>::new());
}

#[test]
fn no_design_stylesheet_outside_a_palette_source_names_a_colour() {
    let palette = design_palette();
    let mut named: HashMap<String, String> = HashMap::new();
    for (appearance, tokens) in palette.appearances() {
        for (token, value) in tokens.iter() {
            named
                .entry(value.to_lowercase())
                .or_insert_with(|| format!("{token} ({appearance})"));
        }
    }
    let literal = Regex::new(r"(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))").unwrap();
    let mut failures = Vec::new();
    for rule in design_style_rules() {
        if PALETTE_SOURCES.contains(&rule.file.as_str()) {
            continue;
        }
        for found in literal.find_iter(&rule.body) {
            let colour = found.as_str();
            let place = format!("{} {}: {colour}", rule.file, rule.selector);
            failures.push(match named.get(&colour.to_lowercase()) {
                Some(token) => {
                    format!("{place} is {token}; use the token so it follows the appearance")
                }
                None => {
                    format!("{place} has no palette role; add one or move it to a palette source")
                }
            });
        }
    }
    assert_eq!(failures, Vec::<String>::new());
}
