//! Debug-only process fault adapters. This entire module is absent from release builds.
#![cfg(debug_assertions)]

use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
#[cfg(unix)]
use std::process::ExitCode;
use std::sync::Arc;

use mokly_cli::build::{BuildError, BuildService, BuildSummary, PreparedBuild};
use mokly_cli::grammar::Build;
use mokly_platform::rename::Rename;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, Node, SourceTree};
use mokly_static::error::{Error, InternalError, Result};
use mokly_static::filesystem::Files;
use mokly_static::location::Boundary;
use mokly_static::transaction::{Transaction, Transactions};

#[cfg(unix)]
use crate::interrupts::Interrupts;

mod files;
mod rename;

#[derive(Clone)]
struct Faults {
    names: Vec<String>,
}
impl Faults {
    fn environment() -> Self {
        Self {
            names: env::var("MOKLY_TEST_STATIC_FAULTS")
                .unwrap_or_default()
                .split(',')
                .map(str::to_owned)
                .collect(),
        }
    }
    fn has(&self, name: &str) -> bool {
        self.names.iter().any(|value| value == name)
    }
    fn event(&self, name: &str) {
        if let Some(path) = env::var_os("MOKLY_TEST_STATIC_EVENTS")
            && let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path)
        {
            let _ = writeln!(file, "{name}");
        }
    }
    #[cfg(unix)]
    fn gate(&self, name: &str) -> io::Result<()> {
        if !self.has(name) {
            return Ok(());
        }
        let mut signals = signal_hook::iterator::Signals::new([signal_hook::consts::SIGINT])?;
        let ready = env::var_os("MOKLY_TEST_STATIC_READY")
            .ok_or_else(|| io::Error::other("missing test readiness path"))?;
        fs::write(ready, name)?;
        let _ = signals.wait().next();
        Ok(())
    }
    #[cfg(not(unix))]
    fn gate(&self, _: &str) -> io::Result<()> {
        Ok(())
    }
}

/// Decorate the static filesystem only in debug binaries.
pub(super) fn files(inner: Arc<dyn Files>) -> Arc<dyn Files> {
    Arc::new(files::Injected {
        inner,
        faults: Faults::environment(),
    })
}
/// Decorate exclusive moves for recovery process tests.
pub(super) fn rename(inner: Arc<dyn Rename>) -> Arc<dyn Rename> {
    Arc::new(rename::Injected {
        inner,
        faults: Faults::environment(),
    })
}
/// Gate configuration reads on an actual delivered signal.
pub(super) fn tree(inner: Arc<dyn SourceTree>) -> Arc<dyn SourceTree> {
    Arc::new(InjectedTree {
        inner,
        faults: Faults::environment(),
    })
}
/// Retain compiler errors while a process test delivers cancellation.
pub(super) fn render(inner: Arc<dyn BuildService>) -> Arc<dyn BuildService> {
    Arc::new(InjectedRender {
        inner,
        faults: Faults::environment(),
    })
}
/// Seed an earlier owned output for private-publication recovery tests.
pub(super) fn transactions(inner: Arc<dyn Transactions>) -> Arc<dyn Transactions> {
    Arc::new(InjectedTransactions { inner })
}
struct InjectedTransactions {
    inner: Arc<dyn Transactions>,
}
impl Transactions for InjectedTransactions {
    fn open(&self, output: &Path, boundary: Boundary) -> Result<Box<dyn Transaction>> {
        if let Some(source) = env::var_os("MOKLY_TEST_STATIC_PREVIOUS")
            && let Err(source) = copy(&PathBuf::from(source), output)
        {
            return Err(InternalError::Io {
                operation: "seed test output",
                path: output.into(),
                source,
            }
            .into());
        }
        self.inner.open(output, boundary)
    }
}
fn copy(source: &Path, destination: &Path) -> io::Result<()> {
    fs::create_dir(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            copy(&entry.path(), &destination.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), destination.join(entry.file_name()))?;
        }
    }
    Ok(())
}
struct InjectedTree {
    inner: Arc<dyn SourceTree>,
    faults: Faults,
}
impl SourceTree for InjectedTree {
    fn prefetch(&self, paths: &[PathBuf]) -> mokly_source_interface::error::Result<()> {
        self.inner.prefetch(paths)
    }
    fn read_public(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        self.inner.read_public(path)
    }
    fn open_stream(
        &self,
        path: &Path,
    ) -> mokly_source_interface::error::Result<Box<dyn SourceStream>> {
        self.inner.open_stream(path)
    }
    fn digest_unretained(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.inner.digest_unretained(path)
    }
    fn digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.inner.digest(path)
    }

    fn project(&self, path: &Path) -> mokly_source_interface::error::Result<Option<Node>> {
        self.inner.project(path)
    }
    fn children(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<Child>> {
        self.inner.children(path)
    }
    fn read(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        if path
            .file_name()
            .is_some_and(|name| name == "mokly.config.json")
            && self.faults.has("config")
        {
            let result = self.faults.gate("config");
            return Err(SourceError::Io {
                operation: "injected configuration read",
                path: path.into(),
                source: result
                    .err()
                    .unwrap_or_else(|| io::Error::other("configuration read stopped after signal")),
            });
        }
        self.inner.read(path)
    }
}
struct InjectedRender {
    inner: Arc<dyn BuildService>,
    faults: Faults,
}
impl BuildService for InjectedRender {
    fn prepare(
        &self,
        cwd: &Path,
        options: &Build,
    ) -> std::result::Result<PreparedBuild, BuildError> {
        let result = self.inner.prepare(cwd, options);
        if result.is_err() {
            let _ = self.faults.gate("compile");
        }
        result
    }
    fn run(&self, cwd: &Path, options: &Build) -> std::result::Result<BuildSummary, BuildError> {
        Ok(self.prepare(cwd, options)?.summary)
    }
}

fn failure(path: &Path) -> Error {
    Error::Unexpected { path: path.into() }
}

/// Probe checks registration and listener ownership after each signal session drops.
#[cfg(unix)]
pub(super) fn signal_lifecycle() -> Option<ExitCode> {
    if !Faults::environment().has("handlers") {
        return None;
    }
    for start in [Interrupts::new, Interrupts::publish] {
        let probe = match start() {
            Ok(interrupts) => interrupts.pending_probe.clone(),
            Err(_) => return Some(ExitCode::FAILURE),
        };
        if probe.upgrade().is_some() {
            return Some(ExitCode::FAILURE);
        }
    }
    println!("signal-handlers-released");
    Some(ExitCode::SUCCESS)
}

/// Fixed terminal width for process recovery snapshots, absent from release builds.
pub(super) fn columns(fallback: usize) -> usize {
    env::var("MOKLY_TEST_STATIC_COLUMNS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

#[cfg(test)]
#[path = "_tests_/tree_tests.rs"]
mod tree_tests;
