//! Complete runner outcome vocabulary; lifecycle policy belongs to the caller.

use internal_error::InternalError;

use crate::cli_code::MoklyCliCode;

/// Ordered build steps.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BuildStep {
    /// Initialize, fetch and select the exact head.
    Checkout,
    /// Install the nearest supported tracked lockfile.
    Install,
    /// Select a compatible CLI and publish the catalogue.
    Publish,
}

/// Time limit that stopped a process.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BuildBudget {
    /// The attempt's absolute deadline.
    Deadline,
    /// The step's period without output.
    Idle,
}

/// Result of a single attempt, without publication or retry interpretation.
#[derive(Debug)]
pub enum BuildOutcome {
    /// Every required process exited successfully.
    Completed,
    /// A process failed or had no normal exit status.
    StepFailed {
        /// Step that stopped.
        step: BuildStep,
        /// Normal process exit code, absent for a missing or signal exit.
        exit_code: Option<i32>,
        /// Last plain Mokly stderr code from the publish command, if present.
        cli_error: Option<MoklyCliCode>,
    },
    /// Only a Bun lockfile was tracked in the nearest candidate directory.
    UnsupportedLockfile,
    /// An installed CLI failed its version probe or was below the floor.
    UnsupportedMoklyVersion,
    /// A process exhausted an absolute or idle budget.
    TimedOut {
        /// Step that stopped.
        step: BuildStep,
        /// Time limit that stopped it.
        budget: BuildBudget,
    },
    /// A process stream exceeded its 64 MiB limit.
    OutputOverflow {
        /// Step that produced excess output.
        step: BuildStep,
    },
    /// Safe sandbox, transport, sink, backpressure or file-write failure.
    Infrastructure(InternalError),
}
