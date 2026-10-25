//! Regression cases for strict argument forms and typed CLI errors.

use crate::errors::Failure;
use crate::parsing::{ParseError, parse};

fn arguments(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

#[test]
fn misplaced_repeated_and_hyphen_value_options_fail() {
    for args in [
        vec!["mokly", "--base", "x", "build", "--no-changes"],
        vec!["mokly", "--config", "a", "build", "--config", "b"],
        vec!["mokly", "--base", "x", "build", "--base", "y"],
        vec!["mokly", "--debug-timings", "build", "--debug-timings"],
        vec!["mokly", "--sidecars", "2", "build", "--sidecars", "3"],
        vec!["mokly", "--watch", "serve", "--watch"],
        vec!["mokly", "build", "--out", "-"],
        vec!["mokly", "--config", "-"],
        vec!["mokly", "publish", "--token", "-"],
        vec!["mokly", "--help=false"],
        vec!["mokly", "--version=false"],
        vec!["mokly", "-V"],
        vec!["mokly", "serve", "-V"],
        vec!["mokly", "-h=x"],
        vec!["mokly", "-V=1"],
        vec!["mokly", "-Vx"],
        vec!["mokly", "-v=x"],
        vec!["mokly", "-vx"],
        vec!["mokly", "-hx"],
        vec!["mokly", "build", "--config=a", "--config=b"],
        vec!["mokly", "--help", "-h"],
    ] {
        assert!(
            matches!(parse(&arguments(&args)), Err(ParseError::Invalid(_))),
            "accepted {args:?}"
        );
    }
    for args in [
        vec!["mokly", "--config=-"],
        vec!["mokly", "build", "--out=-"],
        vec!["mokly", "publish", "--token=-"],
    ] {
        assert!(parse(&arguments(&args)).is_ok());
    }
}

#[test]
fn strict_uses_the_command_position_not_an_option_value() {
    for args in [
        vec!["mokly", "serve", "--config", "build", "--strict"],
        vec!["mokly", "--config", "publish", "--strict"],
    ] {
        assert!(matches!(
            parse(&arguments(&args)),
            Err(ParseError::Invalid(Failure::StrictOutsideBuild))
        ));
    }
}
