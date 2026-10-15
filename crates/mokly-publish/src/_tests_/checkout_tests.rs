//! Fixed Git argv, repository scope, status records and explicit cancellation.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::command::{Output, RunnerMock};
use mokly_git::error;
use unimock::{MockFn, Unimock, matching};

use crate::checkout::{Checkout, GitCheckout, Inspection, status_paths};
use crate::error::Error;
use crate::hints::OutputHintsMock;
use crate::identity::ActionsContext;

fn output(value: &[u8]) -> Output {
    Output {
        stdout: value.to_vec(),
        stderr: Vec::new(),
    }
}
fn argv(values: &[&str]) -> Vec<OsString> {
    values.iter().map(OsString::from).collect()
}

#[test]
fn inspect_uses_the_git_root_and_forces_complete_status_regardless_of_git_settings() {
    let runner=Unimock::new((
        RunnerMock::run_cancellable.next_call(matching!((request,_) if request.args==argv(&["rev-parse","--show-toplevel"]) && request.directory==Path::new("/repo/nested"))).returns(Ok(output(b"/repo\n"))),
        RunnerMock::run_cancellable.next_call(matching!((request,_) if request.args==argv(&["rev-parse","--verify","HEAD^{commit}"]) && request.directory==Path::new("/repo"))).returns(Ok(output(format!("{}\n","a".repeat(40)).as_bytes()))),
        RunnerMock::run_cancellable.next_call(matching!((request,_) if request.args==argv(&["status","--porcelain=v1","-z","--untracked-files=all","--ignore-submodules=none","--renames"]))).returns(Ok(output(b" M source.txt\0?? temp/file\0R  renamed.txt\0old.txt\0 M submodule\0"))),
    ));
    let checkout: &dyn Checkout = &GitCheckout {
        runner: Arc::new(runner),
        hints: Arc::new(Unimock::new(
            OutputHintsMock::directories
                .next_call(matching!(_, _))
                .returns(vec!["site".to_owned()]),
        )),
    };
    let inspected = checkout
        .inspect(
            Path::new("/repo/nested"),
            &[PathBuf::from("/repo/temp")],
            &Unimock::new(()),
        )
        .unwrap();
    assert_eq!(
        inspected.changed_paths,
        ["old.txt", "renamed.txt", "source.txt", "submodule"]
    );
}

#[test]
fn nul_status_preserves_controls_spaces_and_both_rename_and_copy_paths() {
    assert!(status_paths(b"R  to name\0from\nname\0C  copy\0from\nname\0?? ").is_err());
    assert_eq!(
        status_paths(b"R  to name\0from\nname\0C  copy\0from\nname\0?? \xc3\xa9.txt\0").unwrap(),
        ["copy", "from\nname", "to name", "é.txt"]
    );
    for invalid in [b"bad".as_slice(), b" M \0R  to\0".as_slice()] {
        assert!(status_paths(invalid).is_err());
    }
}

#[test]
fn publication_prefers_origin_accepts_sole_remote_and_handles_detached_head() {
    for remotes in ["origin\nother\n", "only\n"] {
        let name = if remotes.starts_with("origin") {
            "origin"
        } else {
            "only"
        };
        let runner=Unimock::new((
            RunnerMock::run_cancellable.next_call(matching!((request,_) if request.args==argv(&["remote"]))).returns(Ok(output(remotes.as_bytes()))),
            RunnerMock::run_cancellable.next_call(matching!(_, _)).answers_arc(Arc::new(move |_,request,_|{assert_eq!(request.args,argv(&["remote","get-url","--",name]));Ok(output(b"git@example.com:group/project.git\n"))})),
            RunnerMock::run_cancellable.next_call(matching!((request,_) if request.args==argv(&["symbolic-ref","--quiet","--short","HEAD"]))).returns(Err(error::Error::CommandFailed {status:Some(1),stderr:Vec::new()})),
        ));
        let checkout: &dyn Checkout = &GitCheckout {
            runner: Arc::new(runner),
            hints: Arc::new(Unimock::new(())),
        };
        let inspection = Inspection {
            root: "/repo".into(),
            head_sha: "a".repeat(40),
            changed_paths: Vec::new(),
            build_directories: Vec::new(),
        };
        let publication = checkout
            .publication(
                &inspection,
                "0.14.0",
                None,
                &ActionsContext::default(),
                &Unimock::new(()),
            )
            .unwrap();
        assert_eq!(publication.branch, "HEAD");
        assert_eq!(publication.head_sha, "a".repeat(40));
        assert_eq!(publication.repository.name, "project");
    }
}

#[test]
fn ambiguous_remotes_git_failures_and_actual_cancellation_keep_separate_types() {
    let runner = Unimock::new(
        RunnerMock::run_cancellable
            .next_call(matching!(_, _))
            .returns(Ok(output(b"one\ntwo\n"))),
    );
    let checkout: &dyn Checkout = &GitCheckout {
        runner: Arc::new(runner),
        hints: Arc::new(Unimock::new(())),
    };
    let inspection = Inspection {
        root: "/repo".into(),
        head_sha: "a".repeat(40),
        changed_paths: Vec::new(),
        build_directories: Vec::new(),
    };
    assert!(matches!(
        checkout.publication(
            &inspection,
            "0.14.0",
            None,
            &ActionsContext::default(),
            &Unimock::new(())
        ),
        Err(Error::Repository)
    ));
    for source in [
        error::Error::Cancelled,
        error::Error::CommandFailed {
            status: Some(1),
            stderr: b"secret response".to_vec(),
        },
    ] {
        let cancelled = matches!(&source, error::Error::Cancelled);
        let runner = Unimock::new(
            RunnerMock::run_cancellable
                .next_call(matching!(_, _))
                .returns(Err(source)),
        );
        let checkout: &dyn Checkout = &GitCheckout {
            runner: Arc::new(runner),
            hints: Arc::new(Unimock::new(())),
        };
        let error = checkout
            .inspect(Path::new("/repo"), &[], &Unimock::new(()))
            .unwrap_err();
        assert!(if cancelled {
            matches!(error, Error::Cancelled)
        } else {
            matches!(error, Error::Checkout)
        });
        assert!(!error.to_string().contains("secret"));
    }
}

#[test]
fn authenticated_reservation_paths_are_excluded_through_the_filesystem_boundary() {
    let runner = Unimock::new((
        RunnerMock::run_cancellable.next_call(matching!(_, _)).returns(Ok(output(b"/repo\n"))),
        RunnerMock::run_cancellable.next_call(matching!(_, _)).returns(Ok(output(format!("{}\n", "a".repeat(40)).as_bytes()))),
        RunnerMock::run_cancellable.next_call(matching!(_, _)).returns(Ok(output(b"?? .mokly-export-reservations/.owner\0?? .mokly-export-reservations/locks/site/.owner\0"))),
    ));
    let hints = Unimock::new(
        OutputHintsMock::reservations
            .next_call(matching!(_, _))
            .returns(vec![".mokly-export-reservations".to_owned()]),
    );
    let checkout: &dyn Checkout = &GitCheckout {
        runner: Arc::new(runner),
        hints: Arc::new(hints),
    };
    assert!(
        checkout
            .inspect(Path::new("/repo"), &[], &Unimock::new(()))
            .unwrap()
            .changed_paths
            .is_empty()
    );
}
