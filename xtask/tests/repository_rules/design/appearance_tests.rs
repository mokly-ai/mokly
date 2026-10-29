//! Both interface palettes theme the same roles and meet their contrast pairs.

use crate::support::read_text;

use super::palette::{contrast, design_palette};

/// Each recorded pair: label, foreground token, background token, minimum.
/// WCAG exempts disabled controls, so their pair has the minimum 0: it is
/// recorded, not required.
const CONTRAST_PAIRS: [(&str, &str, &str, f64); 24] = [
    ("ink on surface", "--chrome-ink", "--chrome-surface", 4.5),
    ("ink on background", "--chrome-ink", "--chrome-bg", 4.5),
    (
        "secondary ink on surface",
        "--chrome-ink-2",
        "--chrome-surface",
        4.5,
    ),
    (
        "muted on surface",
        "--chrome-muted",
        "--chrome-surface",
        4.5,
    ),
    ("muted on background", "--chrome-muted", "--chrome-bg", 4.5),
    (
        "muted on raised (navigation)",
        "--chrome-muted",
        "--chrome-raised",
        4.5,
    ),
    (
        "muted on hover surface",
        "--chrome-muted",
        "--chrome-hover",
        4.5,
    ),
    (
        "accent link on surface",
        "--chrome-accent",
        "--chrome-surface",
        4.5,
    ),
    (
        "brand mark on surface",
        "--chrome-brand",
        "--chrome-surface",
        3.0,
    ),
    ("sage on surface", "--mbk-sage", "--chrome-surface", 4.5),
    (
        "deep sage on surface",
        "--mbk-sage-deep",
        "--chrome-surface",
        4.5,
    ),
    (
        "deep sage on accent surface",
        "--mbk-sage-deep",
        "--mbk-accent-surface",
        4.5,
    ),
    (
        "accent contrast on sage (active row)",
        "--mbk-accent-contrast",
        "--mbk-sage",
        4.5,
    ),
    (
        "control edge on surface",
        "--chrome-control-edge",
        "--chrome-surface",
        3.0,
    ),
    (
        "control edge on background",
        "--chrome-control-edge",
        "--chrome-bg",
        3.0,
    ),
    (
        "control edge on raised (navigation)",
        "--chrome-control-edge",
        "--chrome-raised",
        3.0,
    ),
    (
        "focus outline (deep sage) on background",
        "--mbk-sage-deep",
        "--chrome-bg",
        3.0,
    ),
    (
        "state boundary (deep sage) on accent surface",
        "--mbk-sage-deep",
        "--mbk-accent-surface",
        3.0,
    ),
    (
        "validation ink on validation surface",
        "--mbk-danger-ink",
        "--mbk-danger-bg",
        4.5,
    ),
    (
        "disabled ink on disabled surface",
        "--chrome-disabled-ink",
        "--chrome-disabled-bg",
        0.0,
    ),
    (
        "changed status ink on its surface",
        "--mbk-status-changed-ink",
        "--mbk-status-changed-bg",
        4.5,
    ),
    (
        "removed status ink on its surface",
        "--mbk-status-removed-ink",
        "--mbk-status-removed-bg",
        4.5,
    ),
    (
        "added status ink on its surface",
        "--mbk-sage-deep",
        "--mbk-accent-surface",
        4.5,
    ),
    (
        "validation message on surface",
        "--mbk-danger-ink",
        "--chrome-surface",
        4.5,
    ),
];

/// Font stacks share the palette block but are not appearance roles.
const FONT_STACKS: [&str; 3] = ["--sans", "--serif", "--mono"];

/// The preview tokens that the stage stylesheet declares.
const PREVIEW_TOKENS: [&str; 7] = [
    "--mbk-screen-bg",
    "--mbk-screen-ink",
    "--mbk-screen-ink-2",
    "--mbk-screen-muted",
    "--mbk-screen-border",
    "--mbk-screen-link",
    "--mbk-screen-link-strong",
];

#[test]
fn both_palettes_define_exactly_the_same_semantic_roles() {
    let palette = design_palette();
    let mut light: Vec<&str> = palette
        .light
        .names()
        .filter(|name| !FONT_STACKS.contains(name))
        .collect();
    let mut dark: Vec<&str> = palette.dark.names().collect();
    light.sort_unstable();
    dark.sort_unstable();
    assert_eq!(dark, light);
    for (name, value) in palette.dark.iter() {
        assert_ne!(Some(value), palette.light.get(name), "{name} is not themed");
    }
}

#[test]
fn every_recorded_contrast_pair_meets_its_criterion_in_both_appearances() {
    let palette = design_palette();
    for (label, foreground, background, minimum) in CONTRAST_PAIRS {
        for (appearance, tokens) in palette.appearances() {
            let first = tokens.get(foreground).filter(|value| !value.is_empty());
            let second = tokens.get(background).filter(|value| !value.is_empty());
            let (Some(first), Some(second)) = (first, second) else {
                panic!("{label}: {appearance} tokens are missing");
            };
            let reached = contrast(first, second);
            assert!(
                reached >= minimum,
                "{label} ({appearance}): {reached} < {minimum}"
            );
        }
    }
}

#[test]
fn preview_tokens_stay_independent_of_the_interface_appearance() {
    let palette = design_palette();
    for name in palette.light.names() {
        assert!(
            !name.starts_with("--mbk-screen"),
            "{name} belongs with the preview tokens, not the interface palette"
        );
    }
    let stage = read_text("examples/basic/design-stage.css");
    for name in PREVIEW_TOKENS {
        assert!(stage.contains(&format!("{name}:")), "{name}");
    }
}
