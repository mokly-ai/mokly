//! A kept base is current only while each applicable proof still agrees.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::identity::ObjectId;
use unimock::{MockFn, Unimock, matching};

use crate::base_freshness::{Freshness, FreshnessChecks, FreshnessRequest, InstallInputsMock};
use crate::base_selection::PinnedBase;
use crate::working_inputs::WorkingInputsMock;

use super::support::{catalogue, checkout, generation, inputs, pinned, selection};

#[test]
fn working_install_freshness_checks_selection_records_modules_and_checkout() {
    for change in [
        "equal",
        "lockfile",
        "install",
        "module",
        "unknown-module",
        "base-only",
        "checkout",
    ] {
        let roots = [PathBuf::from("/repo/node_modules")];
        let install = if change == "install" {
            Unimock::new(InstallInputsMock::read.stub(|each| {
                each.call(matching!((root) if *root == Path::new("/repo/node_modules")))
                    .answers(&|_, _| Ok(Some("original-install".into())))
                    .once()
                    .then()
                    .answers(&|_, _| Ok(Some("changed-install".into())))
                    .once();
            }))
        } else {
            Unimock::new(
                InstallInputsMock::read
                    .each_call(matching!((root) if *root == Path::new("/repo/node_modules")))
                    .answers(&|_, _| Ok(Some("original-install".into())))
                    .n_times(if ["lockfile", "checkout"].contains(&change) {
                        1
                    } else {
                        2
                    }),
            )
        };
        let working = if change == "checkout" {
            Unimock::new(())
        } else {
            Unimock::new(
                WorkingInputsMock::read
                    .some_call(matching!(_))
                    .returns(Ok(inputs(if change == "lockfile" {
                        b"changed lock"
                    } else {
                        b"original lock"
                    }))),
            )
        };
        let checks = FreshnessChecks {
            installs: Arc::new(install),
            working: Arc::new(working),
        };
        let base = catalogue(&[
            ("node_modules/shared.js", Some("original-module")),
            ("specs/screen.ts", Some("base-source")),
        ]);
        let recorded = checks
            .record(checkout(), selection(), Some(&roots), &base)
            .unwrap()
            .unwrap();
        assert_eq!(recorded.installed_modules.len(), 1, "{change}");
        let mut identity = checkout();
        if change == "checkout" {
            identity.digest = "changed-checkout".into();
        }
        let selected = pinned(identity);
        let modules = match change {
            "module" => vec![("node_modules/shared.js", Some("changed-module"))],
            "unknown-module" => vec![("node_modules/shared.js", None)],
            "base-only" => Vec::new(),
            _ => vec![("node_modules/shared.js", Some("original-module"))],
        };
        let head = if ["equal", "module", "unknown-module", "base-only"].contains(&change) {
            generation(&modules)
        } else {
            Unimock::new(())
        };
        assert_eq!(
            checks
                .current(
                    &recorded,
                    &FreshnessRequest {
                        selected: &selected,
                        head: &head,
                        directories: &["node_modules".into()],
                        unmapped: &[],
                    }
                )
                .unwrap(),
            ["equal", "base-only"].contains(&change),
            "{change}"
        );
    }
}

#[test]
fn installed_base_ignores_working_install_and_modules_but_checks_dependency_selection() {
    for changed in [false, true] {
        let checks = FreshnessChecks {
            installs: Arc::new(Unimock::new(())),
            working: Arc::new(Unimock::new(
                WorkingInputsMock::read
                    .some_call(matching!(_))
                    .returns(Ok(inputs(if changed {
                        b"changed lock"
                    } else {
                        b"original lock"
                    }))),
            )),
        };
        let recorded = checks
            .record(checkout(), selection(), None, &catalogue(&[]))
            .unwrap()
            .unwrap();
        assert!(recorded.installations.is_empty());
        assert!(recorded.installed_modules.is_empty());
        assert_eq!(
            checks
                .current(
                    &recorded,
                    &FreshnessRequest {
                        selected: &pinned(checkout()),
                        head: &Unimock::new(()),
                        directories: &["node_modules".into()],
                        unmapped: &[],
                    }
                )
                .unwrap(),
            !changed,
            "changed={changed}"
        );
    }
}

#[test]
fn html_checks_exact_governing_paths_and_head_directory_selection() {
    for changed in [false, true] {
        let mut selection = selection();
        selection.paths = Some(selection.inputs.files.keys().cloned().collect());
        let working = if changed {
            Unimock::new(())
        } else {
            Unimock::new(WorkingInputsMock::read_paths.some_call(matching!((_, _, paths, _) if paths.len() == 1 && paths[0].as_str() == "package-lock.json"))
                .returns(Ok(inputs(b"original lock"))))
        };
        let checks = FreshnessChecks {
            installs: Arc::new(Unimock::new(())),
            working: Arc::new(working),
        };
        let recorded = checks
            .record(checkout(), selection, Some(&[]), &catalogue(&[]))
            .unwrap()
            .unwrap();
        let selected = if changed {
            PinnedBase {
                repository: Arc::new(Unimock::new(())),
                reference: "main".into(),
                commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            }
        } else {
            pinned(checkout())
        };
        let directories = if changed {
            vec!["packages/other/node_modules".into()]
        } else {
            vec!["node_modules".into()]
        };
        assert_eq!(
            checks
                .current(
                    &recorded,
                    &FreshnessRequest {
                        selected: &selected,
                        head: &Unimock::new(()),
                        directories: &directories,
                        unmapped: &[]
                    }
                )
                .unwrap(),
            !changed
        );
    }
}

#[test]
fn filtered_or_unproven_installs_are_not_retained() {
    for filtered in [false, true] {
        let installs = if filtered {
            Unimock::new(())
        } else {
            Unimock::new(
                InstallInputsMock::read
                    .some_call(matching!(_))
                    .returns(Ok(None)),
            )
        };
        let checks = FreshnessChecks {
            installs: Arc::new(installs),
            working: Arc::new(Unimock::new(())),
        };
        let mut checkout = checkout();
        checkout.filtered = filtered;
        assert!(
            checks
                .record(
                    checkout,
                    selection(),
                    Some(&["/repo/node_modules".into()]),
                    &catalogue(&[])
                )
                .unwrap()
                .is_none()
        );
    }
}
