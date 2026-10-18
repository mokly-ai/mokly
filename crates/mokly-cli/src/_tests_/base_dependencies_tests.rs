//! Base package roots retain config-relative meaning after extraction.

use std::collections::BTreeMap;

use mokly_catalogue::config_types::{Config, ModuleResolution, ResolvedConfig};
use mokly_compare::dependency_types::Tier;

#[test]
fn dependency_timing_tiers_match_the_three_documented_numbers() {
    for (tier, number) in [
        (Tier::Working, 1),
        (Tier::Installed, 2),
        (Tier::Fallback, 3),
    ] {
        assert_eq!(super::tier_number(tier), number);
    }
}

#[test]
fn package_roots_are_normalized_before_selecting_dependency_tiers() {
    let config = ResolvedConfig {
        input: Config {
            module_resolution: Some(ModuleResolution {
                package_roots: Some(vec!["../packages/one".into(), "./other".into()]),
                aliases: Some(BTreeMap::from([(
                    "react-native".into(),
                    "react-native-web".into(),
                )])),
                conditions: Some(vec!["react-native".into()]),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/config/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let selected = super::resolution(&config).unwrap();
    assert_eq!(selected.package_roots, ["packages/one", "config/other"]);
    assert_eq!(selected.aliases["react-native"], "react-native-web");
    assert_eq!(selected.conditions, ["react-native"]);
}
