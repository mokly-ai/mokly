//! Built-CLI catalogue scenarios against the strict stateful Stripe double.

use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, SecondsFormat, Utc};
use tempfile::TempDir;

use super::stripe_catalogue_double::{Call, StripeDouble};

mod archive_tests;
mod failure_tests;
mod sync_tests;

const CHECK_OUTPUT: &str = concat!(
    "product mokly_team intended name=\"Mokly Team\" active=true metadata.mokly_lookup_key=mokly_team\n",
    "price mokly_team_editor_usd_month intended product=mokly_team currency=usd unit_amount=2000 recurring.interval=month recurring.usage_type=licensed tax_behavior=exclusive nickname=\"Editor seat\" metadata.mokly_seat_kind=editor\n",
    "price mokly_team_collaborator_usd_month intended product=mokly_team currency=usd unit_amount=500 recurring.interval=month recurring.usage_type=licensed tax_behavior=exclusive nickname=\"Collaborator seat\" metadata.mokly_seat_kind=collaborator\n",
);

fn run_sync(stripe: &StripeDouble, key: &str, apply: bool, environment: &str) -> Output {
    run_operation(stripe, key, "sync", apply, environment)
}

fn run_archive(stripe: &StripeDouble, key: &str, apply: bool, environment: &str) -> Output {
    run_operation(stripe, key, "archive", apply, environment)
}

fn run_operation(
    stripe: &StripeDouble,
    key: &str,
    operation: &str,
    apply: bool,
    environment: &str,
) -> Output {
    let mut args = vec![operation, "--environment", environment];
    if apply {
        args.push("--apply");
    }
    run_cli(Some(stripe.origin()), Some(key), &args)
}

fn run_cli(origin: Option<&str>, key: Option<&str>, args: &[&str]) -> Output {
    let directory = TempDir::new().unwrap();
    let mut command = Command::new(env!("CARGO_BIN_EXE_stripe-catalogue"));
    command
        .args(args)
        .current_dir(directory.path())
        .env_remove("MKC_STRIPE_CATALOGUE_KEY")
        .env_remove("MKC_STRIPE_API_ORIGIN");
    if let Some(origin) = origin {
        command.env("MKC_STRIPE_API_ORIGIN", origin);
    }
    if let Some(key) = key {
        command.env("MKC_STRIPE_CATALOGUE_KEY", key);
    }
    command.output().unwrap()
}

fn assert_success(output: Output, stdout: &str) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "command failed: {stderr}");
    assert_eq!(String::from_utf8_lossy(&output.stdout), stdout);
    assert_eq!(stderr, "");
}

fn assert_failure(output: Output, stderr: &str) {
    assert_failure_output(output, "", stderr);
}

fn assert_failure_output(output: Output, stdout: &str, stderr: &str) {
    assert!(!output.status.success(), "command unexpectedly succeeded");
    assert_eq!(String::from_utf8_lossy(&output.stdout), stdout);
    assert_eq!(String::from_utf8_lossy(&output.stderr), stderr);
}

fn assert_write_run(calls: &[Call]) -> String {
    let writes = calls
        .iter()
        .filter(|call| call.method == "POST")
        .collect::<Vec<_>>();
    assert!(!writes.is_empty());
    let mut runs = writes.iter().map(|call| run_from_call(call));
    let first = runs.next().unwrap();
    assert!(runs.all(|run| run == first));
    first
}

fn run_from_call(call: &Call) -> String {
    assert!(!call.body.is_empty());
    let key = call.idempotency_key.as_deref().unwrap();
    let run = key
        .strip_prefix("mokly-catalogue:")
        .and_then(|value| value.split_once(':'))
        .map(|(run, _)| run)
        .unwrap();
    assert_eq!(run.len(), 32);
    assert!(
        run.bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    );
    run.to_owned()
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn rfc3339(timestamp: i64) -> String {
    DateTime::<Utc>::from_timestamp(timestamp, 0)
        .unwrap()
        .to_rfc3339_opts(SecondsFormat::Secs, true)
}
