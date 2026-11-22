//! Native source phases preserve pool, extraction, tier, and early lease behavior.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::Config;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::base_dependencies::BaseDependenciesMock;

use super::base_source_support::{
    Events, lease, prepare, side, side_with_tier, sources, steps, tree,
};

#[test]
fn native_base_uses_the_head_pool_and_the_leased_base_source_root() {
    let events = Events::default();
    let dependencies = Unimock::new((
        crate::dependency_source_support::sources(false),
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, selection, early) if selection.directories == [String::from("node_modules")] && selection.unmapped.is_empty() && early.sources.directory == Path::new("/base")))
            .returns(Ok(side(lease()))),
    ));
    let error = prepare(
        Config::default(),
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 1),
        false,
        steps(events.clone()),
    );
    assert!(matches!(*error.source, Error::Catalogue { .. }));
    assert!(events.lock().unwrap().ends_with(&["attach", "rendering"]));
}

#[test]
fn native_base_reports_scripts_off_after_a_tier_two_install() {
    for (tier, install_scripts, expected) in [
        (Tier::Working, false, false),
        (Tier::Installed, true, false),
        (Tier::Installed, false, true),
        (Tier::Fallback, false, false),
    ] {
        let events = Events::default();
        let dependencies = Unimock::new((
            crate::dependency_source_support::sources(false),
            BaseDependenciesMock::prepare
                .next_call(matching!(_, _, _, _))
                .returns(Ok(side_with_tier(lease(), tier))),
        ));
        let error = prepare(
            Config::default(),
            dependencies,
            tree(events.clone()),
            sources(events.clone(), 1),
            install_scripts,
            steps(events),
        );
        assert_eq!(error.scripts_off, expected);
    }
}

#[test]
fn a_renderer_configuration_attaches_an_existing_extraction_before_the_configuration_loads() {
    let events = Events::default();
    let early = lease();
    let dependencies = Unimock::new((
        BaseDependenciesMock::existing_sources
            .next_call(matching!(_))
            .returns(Ok(Some(early.clone()))),
        crate::dependency_source_support::sources(true),
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, _, early) if early.sources.directory == Path::new("/base")))
            .answers_arc(Arc::new(move |_, _, _, _, early| Ok(side(early.sources)))),
    ));
    let error = prepare(
        Config {
            renderer: Some("renderer.tsx".into()),
            ..Config::default()
        },
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 2),
        false,
        steps(events.clone()),
    );
    assert!(matches!(*error.source, Error::Catalogue { .. }));
    let events = events.lock().unwrap();
    assert_eq!(events.first(), Some(&"attach"));
    assert!(events.contains(&"read configuration"));
    assert!(events.ends_with(&["attach", "rendering"]));
}

#[test]
fn a_failed_early_lookup_keeps_the_base_reads_on_git() {
    let events = Events::default();
    let dependencies = Unimock::new((
        BaseDependenciesMock::existing_sources
            .next_call(matching!(_))
            .returns(Err(Error::UnsafeCache {
                path: "/cache".into(),
            })),
        crate::dependency_source_support::sources(false),
        BaseDependenciesMock::prepare
            .next_call(matching!((_, _, _, early) if early.sources.directory == Path::new("/base")))
            .returns(Ok(side(lease()))),
    ));
    let error = prepare(
        Config {
            postcss: Some("postcss.config.mjs".into()),
            ..Config::default()
        },
        dependencies,
        tree(events.clone()),
        sources(events.clone(), 1),
        false,
        steps(events.clone()),
    );
    assert!(matches!(*error.source, Error::Catalogue { .. }));
    let events = events.lock().unwrap();
    assert_eq!(events.first(), Some(&"read configuration"));
    assert!(events.ends_with(&["attach", "rendering"]));
}
