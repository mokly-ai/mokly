//! Real SSH fixture children keep secrets out of the close request environment.
//! The child can finish before a poll wait; fake clocks permit zero waits.

use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::process::Command;
use std::sync::Arc;
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::child_environment::SECRET_VARIABLES;
use crate::remote::adapter_support::TestDirectory;
use crate::remote::clients::blacksmith::SystemBlacksmith;
use crate::remote::contracts::{Blacksmith, ClockSleepMock, Disconnection, InterruptRequestedMock};
use crate::remote::process::SystemProcess;

#[test]
fn ssh_close_removes_secret_variables_and_runs_after_an_interrupt() {
    const MARKER: &str = "MOKLY_SSH_CLOSE_ADAPTER_CHILD";
    if env::var(MARKER).as_deref() != Ok("1") {
        let binaries = TestDirectory::new();
        let ssh = binaries.path().join("ssh");
        let checks: String = SECRET_VARIABLES
            .iter()
            .map(|name| format!("test \"${{{name}+set}}\" != set || exit 7\n"))
            .collect();
        fs::write(&ssh, format!("#!/bin/sh\n{checks}input=''; IFS= read -r input || :\ntest -z \"$input\" || exit 8\n: > close-ran\nprintf 'Exit request sent.\\n'\n")).unwrap();
        fs::set_permissions(&ssh, fs::Permissions::from_mode(0o700)).unwrap();
        let mut child = Command::new(env::current_exe().unwrap());
        child.args([
            "--exact",
            "remote::clients::disconnect::disconnect_process_adapter_tests::ssh_close_removes_secret_variables_and_runs_after_an_interrupt",
        ]);
        child.env(MARKER, "1").env("PATH", binaries.path());
        for name in SECRET_VARIABLES {
            child.env(name, "adapter-test-only-token");
        }
        let output = child.output().unwrap();
        assert!(
            output.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(String::from_utf8_lossy(&output.stdout).contains("running 1 test"));
        return;
    }
    let home = TestDirectory::new();
    let control = home.path().join(".blacksmith/c");
    fs::create_dir_all(&control).unwrap();
    fs::write(control.join("076e10189ff7c84e.sock"), []).unwrap();
    for name in SECRET_VARIABLES {
        assert_eq!(env::var(name).as_deref(), Ok("adapter-test-only-token"));
    }
    let process = Arc::new(SystemProcess {
        interrupt: Arc::new(
            Unimock::new(InterruptRequestedMock.each_call(matching!()).returns(true))
                .no_verify_in_drop(),
        ),
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
    let client = SystemBlacksmith {
        process,
        workspace: home.path().to_owned(),
        home: Some(home.path().to_owned()),
    };
    assert_eq!(
        client.disconnect("tbx_01m4c70wyw6hgykwt2dn0dhn06").unwrap(),
        Disconnection::Closed
    );
    assert!(home.path().join("close-ran").is_file());
}
