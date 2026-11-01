//! Public grammar acceptance and command restrictions.

use clap::CommandFactory;
use mokly_publish::redaction::Secret;

use crate::errors::Failure;
use crate::grammar::{Cli, Verb};
use crate::options::{Environment, validate};
use crate::parsing::{ParseError, parse};
use crate::version::VERSION;

#[test]
fn clap_grammar_is_consistent_and_help_is_plain() {
    Cli::command().debug_assert();
    insta::assert_snapshot!(Cli::command().render_long_help().to_string());
    assert!(matches!(
        try_parse(["mokly", "--version"]),
        Err(ParseError::Version)
    ));
    assert!(!VERSION.is_empty());
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
            "--base-install-scripts",
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
            "--no-base-install-scripts",
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
            "--base-install-scripts",
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
            "--no-base-install-scripts",
            "--sidecars=1",
            "--debug-timings",
        ],
    ] {
        let mut cli = try_parse(&arguments).unwrap();
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
    let mut default = try_parse(["mokly"]).unwrap();
    assert!(default.command.is_none());
    validate(&mut default, &environment).unwrap();
    assert!(default.serve.watch);
    assert_eq!(default.serve.port, Some(4173));
    let mut snapshot = try_parse(["mokly", "serve", "--no-watch", "--port=0"]).unwrap();
    validate(&mut snapshot, &environment).unwrap();
    let Some(Verb::Serve(snapshot)) = snapshot.command else {
        panic!()
    };
    assert!(!snapshot.options.watch);
    assert_eq!(snapshot.options.port, Some(0));
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
        assert!(try_parse(&arguments).is_err(), "accepted {arguments:?}");
    }
}

#[test]
fn environment_fallbacks_and_resource_limits_are_validated() {
    let mut cli = try_parse(["mokly", "publish"]).unwrap();
    let environment = Environment {
        cores: 4,
        sidecars: Some("2".into()),
        sidecar_timeout_ms: None,
        endpoint: Some("https://example.com/plan".into()),
        token: Some(Secret::new("secret==")),
    };
    validate(&mut cli, &environment).unwrap();
    assert_eq!(cli.common().sidecars, Some(2));
    let Some(Verb::Publish(publish)) = cli.command else {
        panic!()
    };
    assert_eq!(publish.token.as_ref().map(Secret::expose), Some("secret=="));
    for (name, value) in [
        ("--token", "bad token"),
        ("--token", "=abc"),
        ("--endpoint", "file:///tmp/plan"),
        ("--endpoint", "https://user:pass@example.com/plan"),
        ("--endpoint", "https://example.com/plan#fragment"),
    ] {
        let mut cli = try_parse(["mokly", "publish", name, value]).unwrap();
        assert!(validate(&mut cli, &environment).is_err());
    }
    let mut cli = try_parse(["mokly", "--sidecars=5"]).unwrap();
    validate(&mut cli, &environment).unwrap();
    assert_eq!(cli.common().sidecars, Some(5));
    let mut cli = try_parse(["mokly"]).unwrap();
    validate(
        &mut cli,
        &Environment {
            cores: 1,
            sidecars: Some("8".into()),
            ..Environment::default()
        },
    )
    .unwrap();
    assert_eq!(cli.common().sidecars, Some(8));
    assert!(try_parse(["mokly", "--port=1", "build"]).is_err());
}

fn try_parse(arguments: impl IntoIterator<Item = impl AsRef<str>>) -> Result<Cli, ParseError> {
    parse(
        &arguments
            .into_iter()
            .map(|argument| argument.as_ref().to_owned())
            .collect::<Vec<_>>(),
    )
}

#[test]
fn timeout_environment_is_parsed_once_and_retained_for_the_pool() {
    for (value, expected) in [("71", 71), ("+1", 1), ("18446744073709551615", u64::MAX)] {
        let mut cli = parse(&["mokly".into()]).unwrap();
        validate(
            &mut cli,
            &Environment {
                sidecar_timeout_ms: Some(value.into()),
                ..Environment::default()
            },
        )
        .unwrap();
        assert_eq!(cli.common().sidecar_timeout_ms, Some(expected));
    }
    for value in ["", "0", "-1", "1.5", " 1", "1 ", "18446744073709551616"] {
        let mut cli = parse(&["mokly".into()]).unwrap();
        assert!(matches!(
            validate(
                &mut cli,
                &Environment {
                    sidecar_timeout_ms: Some(value.into()),
                    ..Environment::default()
                }
            ),
            Err(Failure::SidecarTimeoutEnvironment)
        ));
    }
}

#[test]
fn cli_publish_debug_does_not_expose_raw_tokens() {
    let mut cli = try_parse(["mokly", "publish", "--token=probe-secret-181"]).unwrap();
    assert!(!format!("{cli:?}").contains("probe-secret-181"));
    let Some(Verb::Publish(publish)) = &cli.command else {
        panic!()
    };
    assert!(!format!("{publish:?}").contains("probe-secret-181"));

    validate(
        &mut cli,
        &Environment {
            endpoint: Some("https://example.com/plan".into()),
            cores: 1,
            ..Environment::default()
        },
    )
    .unwrap();
    let Some(Verb::Publish(publish)) = &cli.command else {
        panic!()
    };
    assert!(!format!("{publish:?}").contains("probe-secret-181"));

    let mut environment_cli = try_parse(["mokly", "publish"]).unwrap();
    validate(
        &mut environment_cli,
        &Environment {
            endpoint: Some("https://example.com/plan".into()),
            token: Some(Secret::new("probe-secret-181")),
            cores: 1,
            ..Environment::default()
        },
    )
    .unwrap();
    let Some(Verb::Publish(publish)) = &environment_cli.command else {
        panic!()
    };
    assert!(!format!("{publish:?}").contains("probe-secret-181"));
}
