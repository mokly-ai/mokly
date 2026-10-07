//! Injected side-effect contracts used by remote verification.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::executor::Decision;
use crate::remote::error::Result;

/// Captured process output and its real exit status.
#[derive(Clone, Debug, Default)]
pub(crate) struct Output {
    /// Standard output text.
    pub(crate) stdout: String,
    /// Standard error text.
    pub(crate) stderr: String,
    /// Process code, absent when terminated by a signal.
    pub(crate) code: Option<i32>,
}

impl Output {
    /// Require a normal zero exit.
    pub(crate) fn success(&self) -> bool {
        self.code == Some(0)
    }
    /// Combine streams for identifier parsing.
    pub(crate) fn combined(&self) -> String {
        format!("{}\n{}", self.stdout, self.stderr)
    }
}

/// Ambient environment values and process identity.
#[cfg_attr(test, unimock::unimock(api = [EnvironmentGetMock, EnvironmentPidMock]))]
pub(crate) trait Environment: Send + Sync {
    /// Read one environment variable.
    fn get(&self, name: &str) -> Option<String>;
    /// Read the current process identifier.
    fn pid(&self) -> u32;
}

/// Executable lookup without executing candidate files.
#[cfg_attr(test, unimock::unimock(api = [ProgramsFindMock]))]
pub(crate) trait Programs: Send + Sync {
    /// Search PATH for an executable file.
    fn find(&self, name: &str) -> Result<bool>;
}

/// Time used by run identifiers, durations and process polling.
#[cfg_attr(test, unimock::unimock(api = [ClockStampMock, ClockMillisMock, ClockSleepMock]))]
pub(crate) trait Clock: Send + Sync {
    /// UTC timestamp in YYYYMMDDTHHMMSSZ format.
    fn stamp(&self) -> String;
    /// Millisecond timing value.
    fn millis(&self) -> u128;
    /// Wait between nonblocking process status checks.
    fn sleep(&self);
}

/// Local commit and origin reachability.
#[cfg_attr(test, unimock::unimock(api = [GitHeadMock, GitPublishedMock]))]
pub(crate) trait Git: Send + Sync {
    /// Read the full local HEAD.
    fn head(&self) -> Result<String>;
    /// Check whether an origin ref contains HEAD.
    fn published(&self) -> Result<bool>;
}

/// Blacksmith command boundary with secret-safe authentication.
#[cfg_attr(test, unimock::unimock(api = [BlacksmithVersionMock, BlacksmithLoginMock, BlacksmithListMock, BlacksmithWarmupMock, BlacksmithRunMock, BlacksmithDownloadMock, BlacksmithStatusMock, BlacksmithStopMock]))]
pub(crate) trait Blacksmith: Send + Sync {
    /// Read the CLI version.
    fn version(&self) -> Result<String>;
    /// Authenticate using key bytes on stdin only.
    fn login(&self, key: &str) -> Result<()>;
    /// Verify account access.
    fn list(&self) -> Result<()>;
    /// Dispatch one warmup and retain its output for recovery.
    fn warmup(&self, reference: &str) -> Result<Output>;
    /// Run a probe or logged suite on one box.
    fn run(&self, id: &str, command: &str, log: Option<&Path>) -> Result<Output>;
    /// Download one required report.
    fn download(&self, id: &str, source: &str, target: &Path) -> Result<()>;
    /// Read status before stopping a box.
    fn status(&self, id: &str) -> Result<String>;
    /// Stop one warmed box even after an interrupt.
    fn stop(&self, id: &str) -> Result<()>;
}

/// Optional GitHub workflow cancellation.
#[cfg_attr(test, unimock::unimock(api = [GithubCancelMock]))]
pub(crate) trait Github: Send + Sync {
    /// Cancel a box's GitHub run.
    fn cancel(&self, id: u64) -> Result<()>;
}

/// Working-tree identity script.
#[cfg_attr(test, unimock::unimock(api = [FingerprintReadMock]))]
pub(crate) trait Fingerprint: Send + Sync {
    /// Compute the local source fingerprint.
    fn read(&self) -> Result<String>;
}

/// Existing nine-report aggregate script.
#[cfg_attr(test, unimock::unimock(api = [AggregateValidateMock]))]
pub(crate) trait Aggregate: Send + Sync {
    /// Validate reports for the local commit and minimum runtime.
    fn validate(&self, directory: &Path, head: &str) -> Result<()>;
}

/// Stream destination owned by the log boundary.
#[cfg_attr(test, unimock::unimock(api = [LogSinkWriteMock]))]
pub(crate) trait LogSink: Send + Sync {
    /// Append raw child output.
    fn write(&self, bytes: &[u8]) -> Result<()>;
}

/// Run-local logs and report directories.
#[cfg_attr(test, unimock::unimock(api = [LogsPrepareMock, LogsOpenMock, LogsTailMock]))]
pub(crate) trait Logs: Send + Sync {
    /// Allocate fresh directories for one run.
    fn prepare(&self, run: &str) -> Result<()>;
    /// Open one command's stream destination.
    fn open(&self, path: &Path) -> Result<Arc<dyn LogSink + Send + Sync>>;
    /// Read the last 60 lines of a failed command.
    fn tail(&self, path: &Path) -> Result<String>;
}

/// Interrupt registration and cancellation state.
#[cfg_attr(test, unimock::unimock(api = [InterruptArmMock, InterruptReleaseMock, InterruptRequestedMock]))]
pub(crate) trait Interrupt: Send + Sync {
    /// Install SIGINT, SIGTERM and SIGHUP handling once at the composition root.
    fn arm(&self) -> Result<()>;
    /// Restore immediate signal exit before returning to local execution.
    fn release(&self);
    /// Check whether cancellation was requested.
    fn requested(&self) -> bool;
}

/// Developer-facing output boundary.
#[cfg_attr(test, unimock::unimock(api = [ReporterExecutorMock, ReporterProgressMock, ReporterDecisionMock]))]
pub(crate) trait Reporter: Send + Sync {
    /// Write a decision, information or warning line with the executor prefix.
    fn executor(&self, message: &str);
    /// Write a progress or summary line.
    fn progress(&self, message: &str);
    /// Print exactly one executor result line to standard output.
    fn decision(&self, decision: Decision);
}

/// Shared typed collaborators, constructed only by the CLI.
#[derive(Clone)]
pub(crate) struct Dependencies {
    /// Environment boundary.
    pub(crate) environment: Arc<dyn Environment + Send + Sync>,
    /// PATH lookup boundary.
    pub(crate) programs: Arc<dyn Programs + Send + Sync>,
    /// Clock boundary.
    pub(crate) clock: Arc<dyn Clock + Send + Sync>,
    /// Git boundary.
    pub(crate) git: Arc<dyn Git + Send + Sync>,
    /// Testbox client boundary.
    pub(crate) blacksmith: Arc<dyn Blacksmith + Send + Sync>,
    /// GitHub client boundary.
    pub(crate) github: Arc<dyn Github + Send + Sync>,
    /// Fingerprint boundary.
    pub(crate) fingerprint: Arc<dyn Fingerprint + Send + Sync>,
    /// Aggregate boundary.
    pub(crate) aggregate: Arc<dyn Aggregate + Send + Sync>,
    /// Log file boundary.
    pub(crate) logs: Arc<dyn Logs + Send + Sync>,
    /// Interrupt boundary.
    pub(crate) interrupt: Arc<dyn Interrupt + Send + Sync>,
    /// Terminal output boundary.
    pub(crate) reporter: Arc<dyn Reporter + Send + Sync>,
    /// Pure workspace location.
    pub(crate) workspace: PathBuf,
}
