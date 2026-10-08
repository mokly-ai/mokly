//! HOME-based socket identity and best-effort close of an existing SSH master.

use std::path::PathBuf;

use sha2::{Digest, Sha256};

use crate::remote::clients::blacksmith::SystemBlacksmith;
use crate::remote::clients::outcome::cleanup_success;
use crate::remote::contracts::Disconnection;
use crate::remote::error::{Error, Operation, Result};
use crate::remote::process::Request;

impl SystemBlacksmith {
    /// Derive the CLI socket from HOME and the first eight SHA-256 bytes.
    fn control_socket(&self, id: &str) -> Result<PathBuf> {
        let home = self
            .home
            .as_deref()
            .filter(|home| !home.as_os_str().is_empty())
            .ok_or(Error::MissingHome)?;
        let name: String = Sha256::digest(id.as_bytes())
            .iter()
            .take(8)
            .map(|byte| format!("{byte:02x}"))
            .collect();
        Ok(self
            .workspace
            .join(home)
            .join(".blacksmith/c")
            .join(format!("{name}.sock")))
    }

    /// Close only this box's control socket without creating an SSH connection.
    pub(super) fn disconnect_shared(&self, id: &str) -> Result<Disconnection> {
        let socket = self.control_socket(id)?;
        match socket.try_exists() {
            Ok(false) => return Ok(Disconnection::Absent),
            Ok(true) => {}
            Err(source) => {
                return Err(Error::Io {
                    operation: Operation::Ssh,
                    source,
                });
            }
        }
        let result = self
            .process
            .execute(&Request {
                program: "ssh".into(),
                args: vec![
                    "-F".into(),
                    "/dev/null".into(),
                    "-S".into(),
                    socket.to_string_lossy().into_owned(),
                    "-O".into(),
                    "exit".into(),
                    "localhost".into(),
                ],
                cwd: self.workspace.clone(),
                operation: Operation::Ssh,
                input: None,
                log: None,
                cancellable: false,
                git_index: None,
                blacksmith: false,
            })
            .and_then(|output| cleanup_success(&output, Operation::Ssh));
        match result {
            Ok(()) => Ok(Disconnection::Closed),
            Err(error) => match socket.try_exists() {
                Ok(false) => Ok(Disconnection::Closed),
                Ok(true) => Err(error),
                Err(source) => Err(Error::Io {
                    operation: Operation::Ssh,
                    source,
                }),
            },
        }
    }
}

#[cfg(test)]
#[path = "_tests_/disconnect_adapter_tests.rs"]
mod disconnect_adapter_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/disconnect_process_adapter_tests.rs"]
mod disconnect_process_adapter_tests;
