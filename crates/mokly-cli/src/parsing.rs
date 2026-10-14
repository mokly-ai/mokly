//! Argument forms checked before clap's immediate help and version actions.

use std::collections::BTreeSet;

use clap::Parser;
use clap::error::{ContextKind, ErrorKind};

use crate::errors::Failure;
use crate::grammar::Cli;

const VALUE_OPTIONS: &[&str] = &[
    "--config",
    "--base",
    "--sidecars",
    "--port",
    "--out",
    "--endpoint",
    "--token",
    "--repository",
    "--upload-concurrency",
];

/// A successful immediate response or typed invalid invocation.
#[derive(Debug)]
pub enum ParseError {
    /// Plain help bytes.
    Help(String),
    /// Bare package version bytes.
    Version,
    /// Expected CLI failure.
    Invalid(Failure),
}

/// Parse the CLI with one command level and strict short-flag syntax.
pub fn parse(arguments: &[String]) -> Result<Cli, ParseError> {
    if let Err(failure) = preflight(arguments) {
        return Err(ParseError::Invalid(failure));
    }
    match Cli::try_parse_from(arguments) {
        Ok(cli) => Ok(cli),
        Err(error) if error.kind() == ErrorKind::DisplayHelp => {
            Err(ParseError::Help(error.to_string()))
        }
        Err(error) if error.kind() == ErrorKind::DisplayVersion => Err(ParseError::Version),
        Err(error) => Err(ParseError::Invalid(classify(
            error,
            arguments.get(1).map(String::as_str),
        ))),
    }
}

fn preflight(arguments: &[String]) -> Result<(), Failure> {
    let mut seen = BTreeSet::new();
    let mut index = 1;
    while let Some(argument) = arguments.get(index) {
        if argument == "-V" {
            return Err(Failure::UnknownOption {
                option: argument.clone(),
            });
        }
        if (argument.starts_with("-h") && argument != "-h")
            || (argument.starts_with("-v") && argument != "-v")
            || argument.starts_with("-V")
        {
            return Err(Failure::ShortFlag {
                option: argument.clone(),
            });
        }
        let (option, assigned) = argument
            .split_once('=')
            .map_or((argument.as_str(), false), |(option, _)| (option, true));
        let canonical = match option {
            "-h" => "--help",
            "-v" => "--version",
            option => option,
        };
        if assigned
            && [
                "--watch",
                "--no-watch",
                "--open",
                "--strict",
                "--no-changes",
                "--debug-timings",
                "--help",
                "--version",
            ]
            .contains(&canonical)
        {
            return Err(Failure::BooleanAssignment {
                option: canonical.to_owned(),
            });
        }
        if (VALUE_OPTIONS.contains(&canonical)
            || [
                "--watch",
                "--no-watch",
                "--open",
                "--strict",
                "--no-changes",
                "--debug-timings",
                "--help",
                "--version",
            ]
            .contains(&canonical))
            && !seen.insert(canonical)
        {
            return Err(Failure::RepeatedOption {
                option: canonical.to_owned(),
            });
        }
        if VALUE_OPTIONS.contains(&option) && !assigned {
            if arguments
                .get(index + 1)
                .is_some_and(|value| value.starts_with('-'))
            {
                return Err(Failure::SeparateHyphen {
                    option: option.to_owned(),
                });
            }
            index += 1;
        }
        index += 1;
    }
    Ok(())
}

fn classify(error: clap::Error, command: Option<&str>) -> Failure {
    if error.kind() == ErrorKind::InvalidSubcommand
        && let Some(candidate) = error.get(ContextKind::InvalidSubcommand)
    {
        return Failure::UnknownCommand {
            candidate: candidate.to_string(),
        };
    }
    if error.kind() == ErrorKind::UnknownArgument
        && let Some(option) = error.get(ContextKind::InvalidArg)
    {
        let option = option.to_string();
        if option == "--strict" && !matches!(command, Some("build" | "publish")) {
            return Failure::StrictOutsideBuild;
        }
        return Failure::UnknownOption { option };
    }
    Failure::Syntax { source: error }
}

#[cfg(test)]
#[path = "_tests_/argument_tests.rs"]
mod argument_tests;
