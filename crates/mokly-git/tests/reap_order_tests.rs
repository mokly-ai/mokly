//! The Git runner keeps its root process unreaped until its last tree signal.

#![cfg(unix)]

use std::sync::Arc;

use mokly_git::command::{ProcessMode, Request, Runner};
use mokly_git::control::{SystemClock, Token};
use mokly_git::system::SystemRunner;
use mokly_test_support::reap_order::{Root, Watched};

#[test]
fn a_finished_git_command_is_reaped_only_after_its_last_tree_signal() {
    for process_mode in [ProcessMode::FullTree, ProcessMode::PlainGroup] {
        let groups = Arc::new(Watched::default());
        let runner: &dyn Runner = &SystemRunner {
            clock: Arc::new(SystemClock::default()),
            cancellation: Arc::new(Token::default()),
            groups: groups.clone(),
        };
        let output = runner
            .run(&Request {
                process_mode,
                directory: std::env::current_dir().unwrap(),
                args: vec!["--version".into()],
                stdin: vec![],
                output_limit: 1024,
                stderr_limit: 1024,
            })
            .unwrap();
        assert!(output.stdout.starts_with(b"git version "));
        let states = groups.states();
        assert!(!states.is_empty(), "{process_mode:?}: no tree signal");
        assert!(
            !states.contains(&Root::Reaped),
            "{process_mode:?}: a tree signal followed the reap: {states:?}"
        );
    }
}
