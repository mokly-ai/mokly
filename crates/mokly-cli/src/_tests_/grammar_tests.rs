//! Public grammar acceptance and command restrictions.

use clap::{CommandFactory, Parser};

use crate::grammar::{Cli, Verb};
use crate::options::{Environment, validate};

#[test]
fn clap_grammar_is_consistent_and_help_is_plain() {
    Cli::command().debug_assert();
    insta::assert_snapshot!(Cli::command().render_long_help().to_string());
    let version = Cli::try_parse_from(["mokly", "--version"]).unwrap_err();
    assert_eq!(version.to_string(), "mokly 0.14.0\n");
}

#[test]
fn every_command_accepts_its_complete_option_set() {
    for arguments in [
        vec![
            "mokly",
            "--config=a.json",
            "--base=-topic",
            "--port=0",
            "--watch",
            "--open",
            "--sidecars=1",
            "--debug-timings",
        ],
        vec![
            "mokly",
            "serve",
            "--config",
            "a.json",
            "--base",
            "origin/main",
            "--port",
            "65535",
            "--no-watch",
            "--open",
            "--sidecars",
            "1",
            "--debug-timings",
        ],
        vec![
            "mokly",
            "build",
            "--config=a.json",
            "--out=-directory",
            "--base=main",
            "--strict",
            "--sidecars=1",
            "--debug-timings",
        ],
        vec!["mokly", "build", "--no-changes"],
        vec![
            "mokly",
            "publish",
            "--endpoint=https://example.com/plan?a=b=c",
            "--token=-TOKEN==",
            "--repository=git.example.com/group/project",
            "--upload-concurrency=32",
            "--strict",
            "--no-changes",
            "--sidecars=1",
            "--debug-timings",
        ],
    ] {
        let mut cli = Cli::try_parse_from(&arguments).unwrap();
        validate(
            &mut cli,
            &Environment {
                cores: 4,
                ..Environment::default()
            },
        )
        .unwrap();
    }
    let environment = Environment {
        cores: 4,
        ..Environment::default()
    };
    let mut default = Cli::try_parse_from(["mokly"]).unwrap();
    assert!(default.command.is_none());
    validate(&mut default, &environment).unwrap();
    assert!(default.serve.watch);
    assert_eq!(default.serve.port, Some(4173));
    let mut snapshot = Cli::try_parse_from(["mokly", "serve", "--no-watch", "--port=0"]).unwrap();
    validate(&mut snapshot, &environment).unwrap();
    let Some(Verb::Serve(snapshot)) = snapshot.command else {
        panic!()
    };
    assert!(!snapshot.watch);
    assert_eq!(snapshot.port, Some(0));
}

#[test]
fn assignments_empty_values_and_command_restrictions_fail() {
    for arguments in [
        vec!["mokly", "serve", "--out=dir"],
        vec!["mokly", "serve", "--strict"],
        vec!["mokly", "publish", "--out=dir"],
        vec!["mokly", "build", "--open"],
        vec!["mokly", "build", "--port=1"],
        vec!["mokly", "serve", "--upload-concurrency=1"],
        vec!["mokly", "--help=false"],
        vec!["mokly", "serve", "--watch=false"],
        vec!["mokly", "build", "--strict=true"],
        vec!["mokly", "build", "--no-changes=true"],
        vec!["mokly", "--config="],
        vec!["mokly", "--config", "-file"],
        vec!["mokly", "serve", "--watch", "--no-watch"],
        vec!["mokly", "serve", "--port=65536"],
        vec!["mokly", "--sidecars=0"],
        vec!["mokly", "--sidecars=1.5"],
        vec!["mokly", "publish", "--upload-concurrency=0"],
        vec!["mokly", "publish", "--upload-concurrency=33"],
        vec!["mokly", "build", "--no-changes", "--base=main"],
        vec!["mokly", "publish", "--base=main", "--no-changes"],
        vec!["mokly", "check"],
        vec!["mokly", "export"],
        vec!["mokly", "review"],
    ] {
        assert!(
            Cli::try_parse_from(&arguments).is_err(),
            "accepted {arguments:?}"
        );
    }
}

#[test]
fn environment_fallbacks_and_resource_limits_are_validated() {
    let mut cli = Cli::try_parse_from(["mokly", "publish"]).unwrap();
    let environment = Environment {
        cores: 4,
        sidecars: Some("2".into()),
        endpoint: Some("https://example.com/plan".into()),
        token: Some("secret==".into()),
    };
    validate(&mut cli, &environment).unwrap();
    assert_eq!(cli.common.sidecars, Some(2));
    let Some(Verb::Publish(publish)) = cli.command else {
        panic!()
    };
    assert_eq!(publish.token.as_deref(), Some("secret=="));
    for (name, value) in [
        ("--token", "bad token"),
        ("--token", "=abc"),
        ("--endpoint", "file:///tmp/plan"),
        ("--endpoint", "https://user:pass@example.com/plan"),
        ("--endpoint", "https://example.com/plan#fragment"),
    ] {
        let mut cli = Cli::try_parse_from(["mokly", "publish", name, value]).unwrap();
        assert!(validate(&mut cli, &environment).is_err());
    }
    let mut cli = Cli::try_parse_from(["mokly", "--sidecars=5"]).unwrap();
    assert!(validate(&mut cli, &environment).is_err());
    let mut cli = Cli::try_parse_from(["mokly", "--port=1", "build"]).unwrap();
    assert!(validate(&mut cli, &environment).is_err());
}
