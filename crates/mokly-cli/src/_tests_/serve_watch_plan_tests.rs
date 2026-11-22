//! A record copy with observed resources equals the record that its inputs build.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config_types::{ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_cli::build::{BuildChanges, BuildSummary};
use mokly_cli::serve::PreparedServe;
use mokly_graph::types::RenderGenerationMock;
use mokly_watch::event::Action;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support;

use super::{PlanInputs, PlanRecord, PlanRecords};

/// The configuration of `warning_support` with the one root `specs`.
fn config() -> ResolvedConfig {
    let mut config = warning_support::config();
    config.roots = vec![ResolvedRoot {
        directory: "/repo/specs".into(),
        identity: "/repo/specs".into(),
        input: RootConfig {
            dir: "specs".into(),
            files: None,
            path: None,
            transparent: None,
        },
    }];
    config
}

/// A preparation with one source, one module resolution file and folder, and the resource
/// recordings `resources`.
fn prepared(resources: &[&str]) -> PreparedServe {
    let mut catalogue = warning_support::catalogue(vec![]);
    catalogue.model.sources = vec!["src/new.ts".into()];
    catalogue.javascript.generation = Some(JavaScriptGeneration {
        resolution_files: BTreeSet::from(["package.json".into()]),
        resolution_directories: BTreeMap::from([(
            "node_modules/pkg".into(),
            BTreeSet::from(["index.js".into()]),
        )]),
        ..Default::default()
    });
    let resources: BTreeSet<String> = resources.iter().map(|path| (*path).into()).collect();
    let generation = Unimock::new((
        RenderGenerationMock::catalogue
            .some_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::stylesheet_directories
            .some_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .some_call(matching!())
            .returns(resources),
    ));
    PreparedServe {
        config: config(),
        generation: Arc::new(generation),
        summary: BuildSummary {
            changes: BuildChanges::Disabled,
            documents: 0,
            counts: Default::default(),
            warnings: vec![],
        },
    }
}

#[test]
fn a_copy_with_observed_resources_equals_the_record_of_its_inputs() {
    let base = PlanRecord::new(PlanInputs::of(&prepared(&["assets/base.svg"]))).unwrap();
    let observed = BTreeSet::from([
        "assets/base.svg".into(),
        "assets/logo.svg".into(),
        "specs/images/hero.png".into(),
        "specs/dist/icon.svg".into(),
        "src/new.ts".into(),
    ]);
    let copy = base.with_resources(&observed).unwrap();
    let all = prepared(&[
        "assets/base.svg",
        "assets/logo.svg",
        "specs/images/hero.png",
        "specs/dist/icon.svg",
        "src/new.ts",
    ]);
    let fresh = PlanRecord::new(PlanInputs::of(&all)).unwrap();
    assert!(copy.inputs == fresh.inputs);
    assert_eq!(copy.targets, fresh.targets);
    assert_eq!(copy.plan.exact, fresh.plan.exact);
    assert_eq!(copy.plan.ancestors, fresh.plan.ancestors);
    assert_eq!(copy.plan.roots, fresh.plan.roots);
    assert_eq!(
        copy.plan.exact[Path::new("/repo/assets/logo.svg")],
        Action::Reload
    );
    assert_eq!(
        copy.plan.exact[Path::new("/repo/src/new.ts")],
        Action::Rebuild
    );
    let targets: BTreeSet<PathBuf> = [
        "/repo/specs",
        "/repo/node_modules/pkg",
        "/repo/mokly.config.json",
        "/repo/package.json",
        "/repo/src/new.ts",
        "/repo/assets/base.svg",
        "/repo/assets/logo.svg",
        "/repo/specs/dist/icon.svg",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect();
    assert_eq!(copy.targets, targets);
}

#[test]
fn the_records_hold_the_adopted_record_and_one_copy_of_the_newest_resources() {
    let adopted = Arc::new(PlanRecord::new(PlanInputs::of(&prepared(&[]))).unwrap());
    let records = PlanRecords::adopted(adopted.clone());
    let first = records
        .with_resources(&BTreeSet::from(["assets/logo.svg".into()]))
        .unwrap();
    let second = first
        .with_resources(&BTreeSet::from(["assets/hero.png".into()]))
        .unwrap();
    let found = |records: &PlanRecords, resources: &[&str]| {
        records.find(&PlanInputs::of(&prepared(resources)))
    };
    assert!(found(&second, &[]).is_some_and(|record| Arc::ptr_eq(&record, &adopted)));
    assert!(
        found(&second, &["assets/hero.png", "assets/logo.svg"]).is_some(),
        "the copy holds every observed resource"
    );
    assert!(
        found(&second, &["assets/logo.svg"]).is_none(),
        "the second copy replaced the first one, so the records hold two records at most"
    );
    assert!(
        second
            .with_resources(&BTreeSet::from(["assets/logo.svg".into()]))
            .is_none(),
        "a resource that the copy holds makes no new records"
    );
}
