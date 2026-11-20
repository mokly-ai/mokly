//! Native fixture Node launcher with an optional manager install probe.

use std::env;
use std::io;
use std::path::Path;
use std::process::{self, Command, Stdio};

fn main() -> io::Result<()> {
    let executable = env::current_exe()?;
    let parent = executable
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| io::Error::other("manager launcher has no fixture parent"))?;
    let probe = parent
        .join(env!("MOKLY_MANAGER_ROOT_NAME"))
        .join(".context/manager-probe.cjs");
    let mut node = Command::new(env!("MOKLY_MANAGER_NODE"));
    if probe.is_file() {
        node.arg("--require").arg(probe);
    }
    let status = node
        .args(env::args_os().skip(1))
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;
    process::exit(status.code().unwrap_or(1));
}
