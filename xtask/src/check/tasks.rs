//! Author-invoked cloud generation and operator subprocess tasks.

use crate::command::CommandSpec;

/// Operations that intentionally generate files or invoke the AGPL operator tool.
pub(crate) enum Task {
    /// Generate or compare cloud contract fixtures.
    MoklyFixtures { check: bool },
    /// Generate or compare committed email templates.
    EmailTemplates { check: bool },
    /// Delegate operator arguments to the cloud crate's binary.
    StripeCatalogue { args: Vec<String> },
}

pub(super) fn task_commands(task: Task) -> Vec<CommandSpec> {
    match task {
        Task::MoklyFixtures { check } => {
            let mut generator = CommandSpec::new("node").args(["xtask/scripts/mokly-fixtures.mjs"]);
            if check {
                generator = generator.args(["--check"]);
            }
            vec![
                CommandSpec::new("npm").args(["run", "build"]),
                generator,
                CommandSpec::new("cargo").args([
                    "test",
                    "--locked",
                    "-p",
                    "mkc-mokly-contract",
                    "--test",
                    "dogfood",
                ]),
            ]
        }
        Task::EmailTemplates { check } => {
            let mut commands = vec![
                CommandSpec::new("npm").args(["run", "build"]),
                CommandSpec::new("npm").args([
                    "run",
                    if check {
                        "emails:check"
                    } else {
                        "emails:build"
                    },
                ]),
            ];
            if check {
                commands.push(CommandSpec::new("npm").args(["run", "emails:test"]));
            }
            commands
        }
        Task::StripeCatalogue { args } => vec![
            CommandSpec::new("cargo")
                .args([
                    "run",
                    "--locked",
                    "-p",
                    "mkc-billing-stripe",
                    "--bin",
                    "stripe-catalogue",
                    "--",
                ])
                .args(args),
        ],
    }
}
