//! Exact process scripts with the product's published CLI command builder.

use mkc_build_interface::outcome::BuildStep;
use sandbox_interface::{Error, ProcessEventStream, ProcessStreamEvent, ProcessStreamOutcome};

use crate::command::{REPO, args};
use crate::publish::fallback_cli;

use super::fixtures::SHA;

pub(super) struct Call {
    pub(super) step: BuildStep,
    pub(super) program: String,
    pub(super) args: Vec<String>,
    pub(super) cwd: String,
    pub(super) publish: bool,
    pub(super) events: Vec<ProcessStreamEvent>,
    pub(super) budget: u64,
    pub(super) advance: i64,
    pub(super) stream: Option<ProcessEventStream>,
    pub(super) error: Option<Error>,
}

impl Call {
    pub(super) fn new(step: BuildStep, program: &str, argv: &[&str], cwd: &str) -> Self {
        Self {
            step,
            program: program.into(),
            args: args(argv),
            cwd: cwd.into(),
            publish: false,
            events: events(0, "", ""),
            budget: 900,
            advance: 0,
            stream: None,
            error: None,
        }
    }
    pub(super) fn output(mut self, stdout: &str) -> Self {
        self.events = events(0, stdout, "");
        self
    }
    pub(super) fn exit(mut self, code: i32) -> Self {
        self.events = events(code, "", "");
        self
    }
    pub(super) fn publishing(mut self) -> Self {
        self.publish = true;
        self
    }
}

pub(super) fn events(exit_code: i32, stdout: &str, stderr: &str) -> Vec<ProcessStreamEvent> {
    vec![
        ProcessStreamEvent::Started { pid: 11 },
        ProcessStreamEvent::Stdout(stdout.as_bytes().to_vec()),
        ProcessStreamEvent::Stderr(stderr.as_bytes().to_vec()),
        ProcessStreamEvent::Exited {
            exit_code,
            exited: true,
        },
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
    ]
}

pub(super) fn checkout() -> Vec<Call> {
    let step = BuildStep::Checkout;
    vec![
        Call::new(step, "git", &["init", "--quiet", REPO], "/workspace"),
        Call::new(
            step,
            "git",
            &[
                "config",
                "--local",
                "credential.helper",
                "store --file=/home/user/.mokly-git-credentials",
            ],
            REPO,
        ),
        Call::new(
            step,
            "git",
            &[
                "remote",
                "add",
                "origin",
                "https://github.com/owner/repo.git",
            ],
            REPO,
        ),
        Call::new(
            step,
            "git",
            &[
                "fetch",
                "--no-tags",
                "--progress",
                "--depth=50",
                "origin",
                SHA,
            ],
            REPO,
        ),
        checkout_end(),
    ]
}

pub(super) fn checkout_end() -> Call {
    Call::new(
        BuildStep::Checkout,
        "git",
        &[
            "checkout",
            "--quiet",
            "--force",
            "-B",
            "feature/builds",
            SHA,
            "--",
        ],
        REPO,
    )
}
pub(super) fn locks() -> Call {
    Call::new(
        BuildStep::Install,
        "git",
        &[
            "ls-files",
            "-z",
            "--",
            "pnpm-lock.yaml",
            "yarn.lock",
            "package-lock.json",
            "npm-shrinkwrap.json",
            "bun.lock",
            "bun.lockb",
        ],
        REPO,
    )
}
pub(super) fn local_test(parent: &str) -> Call {
    Call::new(
        BuildStep::Publish,
        "test",
        &["-x", &format!("{parent}/node_modules/.bin/mokly")],
        REPO,
    )
    .exit(1)
}
pub(super) fn fallback() -> Call {
    fallback_for("mokly.config.json", None)
}

pub(super) fn fallback_for(config: &str, base: Option<&str>) -> Call {
    let command = fallback_cli();
    let mut call = Call::new(BuildStep::Publish, &command.program, &[], REPO).publishing();
    call.args = command.args;
    call.args.extend(args(&[
        "--config",
        config,
        "--repository",
        "github.com/owner/repo",
    ]));
    call.args.extend(match base {
        Some(base) => args(&["--base", base]),
        None => args(&["--no-changes"]),
    });
    call
}
pub(super) fn complete() -> Vec<Call> {
    let mut calls = checkout();
    calls.extend([locks(), local_test(REPO), fallback()]);
    calls
}
