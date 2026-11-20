//! Standalone scenario selection reaches the listener's mode.

#![allow(clippy::unwrap_used)]

use clap::Parser;

use super::Cli;

#[test]
fn serve_defaults_to_one_installation() {
    let cli = Cli::try_parse_from(["mkc-github-double", "serve"]).unwrap();
    let (_, mode) = cli.command.into_server_settings();

    assert!(!mode.second_installation);
}

#[test]
fn serve_enables_the_second_installation_on_request() {
    let cli = Cli::try_parse_from(["mkc-github-double", "serve", "--second-installation"]).unwrap();
    let (_, mode) = cli.command.into_server_settings();

    assert!(mode.second_installation);
}
