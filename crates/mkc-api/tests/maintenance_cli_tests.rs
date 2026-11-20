//! Scheduled cleanup commands run without GitHub or serving credentials.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::process::Command;

use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_test_pg::scratch_schema::ScratchSchema;
use serde_json::Value;
use tempfile::TempDir;

#[test]
fn cleanup_commands_run_without_github_or_serving_configuration() {
    let Some(schema) = ScratchSchema::create("maintenance_cli") else {
        return;
    };
    let migrations: &dyn MigrationRunner = &DieselMigrations;
    migrations.migrate(schema.scoped_url()).unwrap();
    let objects = TempDir::new().unwrap();
    for (command, message, counts) in [
        (
            "maintain-publications",
            "publication maintenance complete",
            vec!["abandoned", "pruned", "blobs", "orphans"],
        ),
        (
            "prune-github",
            "GitHub records pruned",
            vec!["oauth_flows", "deliveries"],
        ),
    ] {
        let mut process = Command::new("timeout");
        process
            .args(["30", env!("CARGO_BIN_EXE_mkc-api"), command])
            .env_clear()
            .env("MKC_DATABASE_URL", schema.scoped_url());
        if command == "maintain-publications" {
            process
                .env("MKC_ENV", "development")
                .env("MKC_FILE_STORE", "local")
                .env("MKC_FILE_STORE_ROOT", objects.path());
        }
        let output = process.output().unwrap();
        assert!(
            output.status.success(),
            "{command}: {}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        let events: Vec<Value> = String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        let report = events
            .iter()
            .find(|event| event["fields"]["message"] == message)
            .unwrap_or_else(|| panic!("{command} emitted no completion report: {events:?}"));
        for count in counts {
            assert_eq!(report["fields"][count], 0, "{command}: {count}");
        }
        assert_eq!(report["fields"].get("expired"), None);
    }
}
