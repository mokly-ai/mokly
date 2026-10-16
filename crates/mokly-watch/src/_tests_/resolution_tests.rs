//! Resolution metadata and shadowing candidates stay observable without broad walks.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use crate::event::{Action, Event, Kind};
use crate::plan::Plan;
use crate::plan_tests::config;

#[test]
fn resolution_candidates_rebuild_on_membership_but_ignore_unrelated_writes() {
    let mut plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    let roots = plan.roots.clone();
    plan.resolution(
        &BTreeSet::from(["package.json".into(), "library/tsconfig.json".into()]),
        &BTreeMap::from([("library".into(), BTreeSet::from(["editor.swap".into()]))]),
    );
    assert_eq!(plan.roots, roots);
    for path in ["/repo/package.json", "/repo/library/tsconfig.json"] {
        assert_eq!(
            plan.classify(&Event {
                path: path.into(),
                kind: Kind::File
            }),
            Some(Action::Rebuild)
        );
    }
    assert_eq!(
        plan.classify(&Event {
            path: "/repo/library/new.ts".into(),
            kind: Kind::Membership
        }),
        Some(Action::Rebuild)
    );
    assert_eq!(
        plan.classify(&Event {
            path: "/repo/library/editor.swap".into(),
            kind: Kind::File
        }),
        None
    );
    assert_eq!(
        plan.classify(&Event {
            path: "/repo/library/new.ts".into(),
            kind: Kind::File
        }),
        Some(Action::Rebuild),
        "a later write can replace the create descriptor in the inbox"
    );
    assert!(plan.targets().contains(Path::new("/repo/library")));
}
#[test]
fn static_output_and_reservations_are_denied_without_reading_markers() {
    let plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    for path in [
        "/repo/mokly-static/generated.html",
        "/repo/.mokly-export-reservations/pending",
    ] {
        assert!(plan.denied(Path::new(path), false));
        assert_eq!(
            plan.classify(&Event {
                path: path.into(),
                kind: Kind::Membership
            }),
            None
        );
    }
}

#[test]
fn repository_resolution_membership_keeps_configuration_rescan_precedence() {
    let mut plan = Plan::new(&config(), &[], &[], &BTreeSet::new()).unwrap();
    plan.resolution(
        &BTreeSet::from(["package.json".into()]),
        &BTreeMap::from([(String::new(), BTreeSet::new())]),
    );
    assert_eq!(
        plan.classify(&Event {
            path: "/repo".into(),
            kind: Kind::Directory
        }),
        Some(Action::Config)
    );
}
