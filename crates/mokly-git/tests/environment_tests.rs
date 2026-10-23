//! A subprocess probe verifies inherited Git environment handling without globals.

use std::process::{Child, Command};
use std::sync::Arc;

use mokly_git::command::{Request, Runner};
use mokly_git::control::{SystemClock, Token};
use mokly_git::system::SystemRunner;
use mokly_platform::error::Result;
use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

struct CapturingGroups {
    inner: Arc<dyn ProcessGroups>,
}

impl ProcessGroups for CapturingGroups {
    fn configure(&self, command: &mut Command) -> Result<()> {
        for name in [
            "GIT_DIR",
            "GIT_SHALLOW_FILE",
            "GIT_GRAFT_FILE",
            "GIT_REPLACE_REF_BASE",
            "GIT_NO_REPLACE_OBJECTS",
            "GIT_IMPLICIT_WORK_TREE",
        ] {
            assert_eq!(
                command
                    .get_envs()
                    .find(|(key, _)| key == &name)
                    .map(|(_, value)| value),
                Some(None)
            );
        }
        assert!(
            command
                .get_envs()
                .all(|(key, _)| !key.to_string_lossy().starts_with("GIT_CONFIG_"))
        );
        self.inner.configure(command)
    }

    fn attach(&self, child: &Child) -> Result<Box<dyn ProcessGroup>> {
        self.inner.attach(child)
    }
}

#[test]
fn environment_probe() {
    if std::env::var_os("MOKLY_GIT_ENV_PROBE").is_none() {
        return;
    }
    assert_eq!(
        std::env::var("GIT_SHALLOW_FILE").unwrap(),
        "inherited-history"
    );
    let runner: &dyn Runner = &SystemRunner {
        clock: Arc::new(SystemClock::default()),
        cancellation: Arc::new(Token::default()),
        groups: Arc::new(CapturingGroups {
            inner: Arc::new(SystemProcessGroups),
        }),
    };
    let result = runner
        .run(&Request {
            directory: std::env::current_dir().unwrap(),
            args: vec![
                "config".into(),
                "--get".into(),
                "mokly.environment-rule".into(),
            ],
            stdin: vec![],
            output_limit: 1024,
            stderr_limit: 1024 * 1024,
        })
        .unwrap();
    assert_eq!(result.stdout, b"retained\n");
}

#[test]
fn git_drops_history_selection_and_keeps_config_overrides() {
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "environment_probe", "--nocapture"])
        .env("MOKLY_GIT_ENV_PROBE", "1")
        .env("GIT_SHALLOW_FILE", "inherited-history")
        .env("GIT_CONFIG_COUNT", "1")
        .env("GIT_CONFIG_KEY_0", "mokly.environment-rule")
        .env("GIT_CONFIG_VALUE_0", "retained")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("1 passed"));
}
