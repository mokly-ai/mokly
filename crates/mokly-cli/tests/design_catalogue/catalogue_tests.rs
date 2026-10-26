//! The design component, component library, component design, and design links contracts.

use super::fixture::{Catalogue, build};
use super::inventory_checks::{inventory_violations, library_violations, reachability_violations};
use super::library_checks::{adoption_violations, baseline_violations, owner_chain_violations};
use super::link_checks::{expectation_violations, tag_violations};
use super::rules::{keyboard_stop_violations, link_violations, script_violations};
use super::sources::bypass_violations;
use super::stylesheet_checks::{component_sheet_violations, scope_violations};

/// One contract check over the built catalogue, which returns its violations.
type Check = fn(&Catalogue) -> Vec<String>;

/// Every contract check, with the rule that it reports.
const CHECKS: [(&str, Check); 13] = [
    (
        "design screens match the frozen inventory in both viewports",
        inventory_violations,
    ),
    (
        "shared components keep their pages, saved variants, and consumers",
        library_violations,
    ),
    (
        "the frozen screen baseline keeps its light views, and shared components have controls",
        baseline_violations,
    ),
    (
        "each design view records the shared components of its family",
        adoption_violations,
    ),
    (
        "nested and caller-owned instances keep their owner chains",
        owner_chain_violations,
    ),
    (
        "each view links exactly the stylesheets of the components it renders",
        component_sheet_violations,
    ),
    (
        "shared design stylesheets keep their route scopes",
        scope_violations,
    ),
    ("view documents run no consumer scripts", script_violations),
    (
        "every link opens an entry through one portable focus stop",
        link_violations,
    ),
    (
        "outside the component explorer, no keyboard stop opens nothing",
        keyboard_stop_violations,
    ),
    (
        "each control family opens its specified destinations",
        expectation_violations,
    ),
    (
        "Welcome's tag states agree on query, picker, chips, and rows",
        tag_violations,
    ),
    (
        "an artboard link or the catalogue tree reaches every design screen",
        reachability_violations,
    ),
];

#[test]
fn composition_outside_the_library_uses_the_registered_components() {
    assert_eq!(bypass_violations(), Vec::<String>::new());
}

/// One build serves every check; the failure lists each failed check with its violations.
#[test]
fn the_built_example_keeps_every_design_contract() {
    let catalogue = build();
    let failures: Vec<String> = CHECKS
        .iter()
        .filter_map(|(rule, check)| {
            let violations = check(&catalogue);
            (!violations.is_empty()).then(|| format!("{rule}:\n  {}", violations.join("\n  ")))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
