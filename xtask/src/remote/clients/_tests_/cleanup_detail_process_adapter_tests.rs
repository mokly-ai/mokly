//! Cleanup error capture never receives the parent's org token.

use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::process::Command;
use std::sync::Arc;
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::TestDirectory;
use crate::remote::clients::blacksmith::SystemBlacksmith;
use crate::remote::contracts::{Blacksmith, ClockSleepMock};
use crate::remote::process::SystemProcess;

#[test]
fn cleanup_failure_detail_excludes_the_parent_org_token() {
    const MARKER: &str = "MOKLY_CLEANUP_DETAIL_ADAPTER_CHILD";
    const TEST: &str = "remote::clients::outcome::cleanup_detail_process_adapter_tests::cleanup_failure_detail_excludes_the_parent_org_token";
    const TOKEN: &str = "adapter-test-only-cleanup-token";
    if env::var(MARKER).as_deref() != Ok("1") {
        let binaries = TestDirectory::new();
        let blacksmith = binaries.path().join("blacksmith");
        fs::write(&blacksmith, "#!/bin/sh\ntest \"$BLACKSMITH_DISABLE_AUTO_UPDATE\" = 1 || exit 8\nprintf 'tool failure:%s\\n' \"${BLACKSMITH_ORG_TOKEN-}\" >&2\nexit 7\n").unwrap();
        fs::set_permissions(&blacksmith, fs::Permissions::from_mode(0o700)).unwrap();
        let output = Command::new(env::current_exe().unwrap())
            .args(["--exact", TEST])
            .env(MARKER, "1")
            .env("PATH", binaries.path())
            .env("BLACKSMITH_ORG_TOKEN", TOKEN)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(String::from_utf8_lossy(&output.stdout).contains("running 1 test"));
        return;
    }
    assert_eq!(env::var("BLACKSMITH_ORG_TOKEN").as_deref(), Ok(TOKEN));
    let workspace = TestDirectory::new();
    let process = Arc::new(SystemProcess {
        interrupt: Arc::new(Unimock::new(())),
        clock: Arc::new(
            Unimock::new(
                ClockSleepMock
                    .each_call(matching!())
                    .answers(&|_| thread::yield_now()),
            )
            .no_verify_in_drop(),
        ),
        logs: Arc::new(Unimock::new(())),
    });
    let error = SystemBlacksmith {
        process,
        workspace: workspace.path().to_owned(),
        home: None,
    }
    .status("tbx_a")
    .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[xtask/remote] Blacksmith command failed with exit 7: tool failure:"
    );
    assert!(!error.to_string().contains(TOKEN));
}
