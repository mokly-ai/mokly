//! Shared event proof for child termination when a job guard closes.

use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};

use mokly_platform::processes::ProcessGroups;

/// Assert job termination without mistaking stdin EOF for a successful kill.
/// The command must print `ready`, wait for stdin, then print `leaked` and exit.
/// `Child::wait` closes stdin, so a surviving child emits the marker before
/// stdout reaches EOF. The empty-output assertion then fails without hanging.
pub(crate) fn assert_job_close_kills_child(groups: &dyn ProcessGroups, mut command: Command) {
    command.stdin(Stdio::piped()).stdout(Stdio::piped());
    let (mut child, mut reader) = {
        groups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let _group = groups.attach(&child).unwrap();
        let mut reader = BufReader::new(child.stdout.take().unwrap());
        let mut ready = String::new();
        reader.read_line(&mut ready).unwrap();
        assert_eq!(ready.trim(), "ready");
        assert!(child.try_wait().unwrap().is_none());
        (child, reader)
    };
    let status = child.wait().unwrap();
    let mut remaining = String::new();
    reader.read_to_string(&mut remaining).unwrap();
    assert!(
        remaining.is_empty(),
        "child continued after job close with {status}: {remaining:?}"
    );
}
