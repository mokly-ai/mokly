//! Missing programs are reported together before any CLI command starts.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::executor::{Decision, Executor, LocalReason};
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::Error;

fn check(mode: Executor, missing: &'static [&'static str]) {
    let looked_up = Arc::new(Mutex::new(Vec::new()));
    let lookups = looked_up.clone();
    let messages = Arc::new(Mutex::new(Vec::new()));
    let warnings = messages.clone();
    let shared = Arc::new(Unimock::new((
        EnvironmentGetMock
            .each_call(matching!(_))
            .answers(&|_, name| (name == "BLACKSMITH_ORG_TOKEN").then(|| "test-key".into())),
        ProgramsFindMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, name| {
                lookups.lock().unwrap().push(name.to_owned());
                Ok(!missing.contains(&name))
            })),
    )));
    let reporter = Arc::new(if mode == Executor::Auto {
        Unimock::new(
            ReporterExecutorMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    warnings.lock().unwrap().push(message.to_owned());
                })),
        )
    } else {
        Unimock::new(())
    });
    let unused = Arc::new(Unimock::new(()));
    let selector = DefaultSelector {
        dependencies: Dependencies {
            environment: shared.clone(),
            programs: shared,
            clock: unused.clone(),
            git: unused.clone(),
            blacksmith: unused.clone(),
            github: unused.clone(),
            fingerprint: unused.clone(),
            aggregate: unused.clone(),
            logs: unused.clone(),
            interrupt: unused,
            reporter,
            workspace: PathBuf::from("/workspace"),
        },
    };
    let result = selector.select(mode);
    let diagnostic = if mode == Executor::Auto {
        assert_eq!(result.unwrap(), Decision::Local(LocalReason::Program));
        let messages = messages.lock().unwrap();
        assert_eq!(messages.len(), 1);
        assert!(messages[0].starts_with("warning: [xtask/remote] "));
        messages[0].clone()
    } else {
        let error = result.unwrap_err();
        match &error {
            Error::MissingPrograms { programs } => {
                assert_eq!(
                    programs
                        .iter()
                        .map(|program| program.name())
                        .collect::<Vec<_>>(),
                    missing
                );
            }
            _ => panic!("expected a typed missing-program list: {error}"),
        }
        error.to_string()
    };
    assert_eq!(*looked_up.lock().unwrap(), ["blacksmith", "rsync", "ssh"]);
    let mut last = 0;
    for name in ["blacksmith", "rsync", "ssh"] {
        if missing.contains(&name) {
            let position = diagnostic.find(&format!("`{name}`")).unwrap();
            assert!(position >= last);
            last = position;
        } else {
            assert!(!diagnostic.contains(&format!("`{name}`")));
        }
    }
    if missing.contains(&"blacksmith") {
        assert!(diagnostic.contains("curl -fsSL https://get.blacksmith.sh | sh"));
    }
    if missing.contains(&"rsync") || missing.contains(&"ssh") {
        assert!(diagnostic.contains("operating system package manager"));
    }
}

#[test]
fn auto_reports_two_missing_programs_in_one_warning() {
    check(Executor::Auto, &["blacksmith", "ssh"]);
}

#[test]
fn remote_reports_two_missing_programs_in_one_error() {
    check(Executor::Remote, &["rsync", "ssh"]);
}

#[test]
fn auto_reports_three_missing_programs_in_one_warning() {
    check(Executor::Auto, &["blacksmith", "rsync", "ssh"]);
}

#[test]
fn remote_reports_three_missing_programs_in_one_error() {
    check(Executor::Remote, &["blacksmith", "rsync", "ssh"]);
}
