//! Parent-side executable resolution that excludes every relative PATH entry.

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(windows)]
use std::path::PathBuf;
use std::{env, fs, process};

use crate::commands::Command;
use crate::error::{Error, Result};

pub(crate) fn command(request: &Command) -> Result<process::Command> {
    if request.program != "npm" {
        return Ok(process::Command::new(&request.program));
    }
    let paths = env::var_os("PATH").unwrap_or_default();
    let directories = env::split_paths(&paths)
        .filter(|path| path.is_absolute())
        .collect::<Vec<_>>();
    let path = match env::join_paths(&directories) {
        Ok(path) => path,
        Err(_) => return Err(Error::CommandUnavailable),
    };
    #[cfg(unix)]
    for directory in &directories {
        let candidate = directory.join("npm");
        if fs::metadata(&candidate)
            .is_ok_and(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        {
            let mut command = process::Command::new(candidate);
            command.env("PATH", &path);
            return Ok(command);
        }
    }
    #[cfg(windows)]
    {
        let mut command = windows_npm(&directories)?;
        command.env("PATH", path);
        Ok(command)
    }
    #[cfg(not(windows))]
    Err(Error::CommandUnavailable)
}

#[cfg(windows)]
fn windows_npm(directories: &[PathBuf]) -> Result<process::Command> {
    let extensions = env::var_os("PATHEXT").unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".into());
    for directory in directories {
        for extension in extensions
            .to_string_lossy()
            .split(';')
            .filter(|extension| !extension.is_empty())
        {
            let candidate = directory.join(format!("npm{extension}"));
            if !fs::metadata(&candidate).is_ok_and(|metadata| metadata.is_file()) {
                continue;
            }
            if extension.eq_ignore_ascii_case(".exe") || extension.eq_ignore_ascii_case(".com") {
                return Ok(process::Command::new(candidate));
            }
            if !extension.eq_ignore_ascii_case(".cmd") {
                return Err(Error::UnsupportedManager);
            }
            let cli = directory.join("node_modules/npm/bin/npm-cli.js");
            if !cli.is_file() {
                return Err(Error::UnsupportedManager);
            }
            let node = std::iter::once(directory.join("node.exe"))
                .chain(directories.iter().map(|path| path.join("node.exe")))
                .find(|path| path.is_file());
            let Some(node) = node else {
                return Err(Error::CommandUnavailable);
            };
            let mut command = process::Command::new(node);
            command.arg(cli);
            return Ok(command);
        }
    }
    Err(Error::CommandUnavailable)
}
