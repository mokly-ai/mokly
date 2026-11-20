//! Captured generator commands with bounded-lifetime input writers.

use std::io::Write;
use std::process::Stdio;
use std::thread;

use crate::error::{Error, ErrorResultExt, Result};

use super::{CommandSpec, build_command};

pub(super) fn output(spec: &CommandSpec) -> Result<String> {
    eprintln!("$ {}", spec.display());
    let mut command = build_command(spec);
    command.stdin(if spec.input.is_some() {
        Stdio::piped()
    } else {
        Stdio::null()
    });
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().context("start captured command")?;
    let output = thread::scope(|scope| -> Result<_> {
        let writer = child
            .stdin
            .take()
            .zip(spec.input.as_ref())
            .map(|(mut stdin, input)| scope.spawn(move || stdin.write_all(input.as_bytes())));
        let output = child.wait_with_output().context("capture command output")?;
        if let Some(writer) = writer {
            match writer.join() {
                Ok(result) if output.status.success() => result.context("write command input")?,
                Ok(_) => (),
                Err(_) => return Err(Error::InputWriterPanicked),
            }
        }
        Ok(output)
    })?;
    let stdout = String::from_utf8(output.stdout).context("decode command stdout")?;
    let stderr = String::from_utf8(output.stderr).context("decode command stderr")?;
    if !output.status.success() {
        return Err(Error::CommandOutput {
            command: spec.display(),
            code: output.status.code(),
            stdout,
            stderr,
        });
    }
    if !stderr.is_empty() {
        eprint!("{stderr}");
    }
    Ok(stdout)
}
