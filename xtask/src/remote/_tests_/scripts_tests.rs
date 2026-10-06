//! Script and Git command boundaries without real execution.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Aggregate, Fingerprint, Git, Output};
use crate::remote::process::ProcessExecuteMock;
use crate::remote::scripts::SystemScripts;

#[test]
fn git_and_script_contracts_use_the_exact_arguments_and_runtime_profile() {
    let process = Arc::new(Unimock::new(
        ProcessExecuteMock
            .each_call(matching!(_))
            .answers(&|_, request| {
                let output = if request.program == "git" {
                    if request.args == ["rev-parse", "HEAD"] {
                        "b".repeat(40)
                    } else {
                        assert_eq!(
                            request.args,
                            [
                                "for-each-ref",
                                "--contains",
                                "HEAD",
                                "--format=%(refname)",
                                "refs/remotes/origin/"
                            ]
                        );
                        "refs/remotes/origin/main\n".into()
                    }
                } else if request.args[0] == "scripts/verification/source-tree.mjs" {
                    format!("sha256:{}\n", "a".repeat(64))
                } else {
                    assert_eq!(
                        request.args,
                        [
                            "scripts/verification/aggregate.mjs",
                            "--reports",
                            "/reports",
                            "--commit",
                            &"b".repeat(40),
                            "--runtimes",
                            "node-22.14.0"
                        ]
                    );
                    String::new()
                };
                Ok(Output {
                    stdout: output,
                    stderr: String::new(),
                    code: Some(0),
                })
            }),
    ));
    let scripts = SystemScripts {
        process,
        workspace: PathBuf::from("/workspace"),
    };
    assert_eq!(scripts.head().unwrap(), "b".repeat(40));
    assert!(scripts.published().unwrap());
    assert_eq!(
        scripts.read().unwrap(),
        format!("sha256:{}", "a".repeat(64))
    );
    scripts
        .validate(&PathBuf::from("/reports"), &"b".repeat(40))
        .unwrap();
}
