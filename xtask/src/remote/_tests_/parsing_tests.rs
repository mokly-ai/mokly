//! Pure remote command, identifier and output contract regressions.

use crate::executor::{Executor, resolve_executor};
use crate::remote::parse::{
    box_is_completed, probe_identity, require_warmup_id, run_id_from_status, warmup_ids,
};
use crate::remote::plan::commands;

#[test]
fn mode_precedence_uses_the_flag_before_the_environment() {
    assert_eq!(
        resolve_executor(Some(Executor::Local), Some("bad")).unwrap(),
        Executor::Local
    );
    assert_eq!(resolve_executor(None, None).unwrap(), Executor::Auto);
    assert_eq!(
        resolve_executor(None, Some("remote")).unwrap(),
        Executor::Remote
    );
    assert!(resolve_executor(None, Some("bad")).is_err());
}

#[test]
fn completed_status_requires_one_matching_table_row() {
    assert!(box_is_completed(
        "ID STATUS REPO\ntbx_a completed mokly",
        "tbx_a"
    ));
    assert!(box_is_completed(
        "ID REPO STATUS\ntbx_a mokly completed",
        "tbx_a"
    ));
    for output in [
        "completed",
        "tbx_a completed",
        "ID STATUS\ntbx_other completed",
        "ID STATUS\ntbx_a ready",
        "ID STATUS\ntbx_a",
        "ID REPO\ntbx_a completed",
        "ID STATUS\ntbx_a completed\ntbx_a ready",
        "ID STATUS\ntbx_a COMPLETED",
    ] {
        assert!(!box_is_completed(output, "tbx_a"), "{output}");
    }
}

#[test]
fn command_inventory_has_eleven_unique_commands_and_nine_reports() {
    let commands = commands();
    assert_eq!(commands.len(), 11);
    assert_eq!(commands.iter().filter(|command| command.report).count(), 9);
    assert_eq!(
        commands
            .iter()
            .map(|command| command.name.as_str())
            .collect::<Vec<_>>(),
        [
            "repository",
            "package",
            "unit-1-of-4",
            "unit-2-of-4",
            "unit-3-of-4",
            "unit-4-of-4",
            "browser-1-of-4",
            "browser-2-of-4",
            "browser-3-of-4",
            "browser-4-of-4",
            "hydration",
        ]
    );
    assert!(
        commands[2]
            .shell_command("sha256:abc")
            .ends_with("--suite unit --shard 1/4")
    );
}

#[test]
fn warmup_requires_exactly_one_canonical_identifier() {
    assert_eq!(
        require_warmup_id("ready\ntbx_abc123\n").unwrap(),
        "tbx_abc123"
    );
    for output in [
        "",
        "no box",
        "tbx_a\ntbx_b",
        "tbx_a\ntbx_a",
        "tbx_",
        "tbx_UPPER",
    ] {
        assert!(require_warmup_id(output).is_err(), "{output}");
    }
    assert_eq!(warmup_ids("tbx_a\ntbx_b\n"), ["tbx_a", "tbx_b"]);
}

#[test]
fn probe_ignores_status_lines_and_rejects_missing_duplicate_or_different_values() {
    let fingerprint = format!("sha256:{}", "a".repeat(64));
    let head = "b".repeat(40);
    let output = format!("Sync ready\n{fingerprint}\n{head}\nComplete\n");
    assert!(probe_identity(&output, &fingerprint, &head).is_ok());
    for bad in [
        String::new(),
        format!("{fingerprint}\n"),
        format!("{head}\n"),
        format!("{fingerprint}\n{fingerprint}\n{head}"),
        format!("{fingerprint}\n{head}\n{head}"),
        format!("sha256:{}\n{head}", "c".repeat(64)),
        format!("{fingerprint}\n{}", "c".repeat(40)),
    ] {
        assert!(probe_identity(&bad, &fingerprint, &head).is_err());
    }
}

#[test]
fn cleanup_uses_the_first_actions_run_match() {
    assert_eq!(
        run_id_from_status(
            "URL: https://github.com/org/repo/actions/runs/1234 then /actions/runs/5678"
        ),
        Some(1234)
    );
    assert_eq!(run_id_from_status("no URL /actions/runs/bad"), None);
    assert_eq!(
        run_id_from_status("/actions/runs/bad then /actions/runs/5678"),
        Some(5678)
    );
}
