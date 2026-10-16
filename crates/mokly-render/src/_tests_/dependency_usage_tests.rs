//! Only actual ancestor module and stylesheet reads constrain the base install.

use crate::dependency_usage::{DependencyUsage, UsedDependencies};

#[test]
fn unused_and_explicit_roots_do_not_become_ancestor_requirements() {
    let usage: &dyn DependencyUsage = &UsedDependencies::default();
    let aliases = [
        ("app/node_modules".into(), "node_modules".into()),
        ("node_modules".into(), "node_modules/.mokly-roots/1".into()),
    ]
    .into();
    usage.record(&aliases, "app/entry.ts");
    usage.record(&aliases, "node_modules/.mokly-roots/2/explicit/skin.css");
    assert!(usage.directories().is_empty());
    usage.record(&aliases, "node_modules/theme/index.js");
    usage.record(&aliases, "node_modules/theme/skin.css");
    assert_eq!(usage.directories(), ["app/node_modules"]);
    usage.record(&aliases, "node_modules/.mokly-roots/1/pkg/skin.css");
    assert_eq!(usage.directories(), ["app/node_modules", "node_modules"]);
}

#[test]
fn canonical_duplicates_keep_the_nearest_ancestor() {
    let usage: &dyn DependencyUsage = &UsedDependencies::default();
    let aliases = [
        ("app/node_modules".into(), "node_modules".into()),
        ("node_modules".into(), "node_modules".into()),
    ]
    .into();
    usage.record(&aliases, "node_modules/theme/index.js");
    assert_eq!(usage.directories(), ["app/node_modules"]);
}
