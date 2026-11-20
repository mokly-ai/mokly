//! Comparison steps let a command show what Changes does while it runs.

/// One visible step of a comparison. A step lasts until the next step starts or Changes ends.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Step {
    /// Read the base configuration and catalogue sources from Git.
    Reading,
    /// Write the files of the base commit to the source cache.
    Extracting,
    /// Install the third-party dependencies of the base commit.
    Installing,
    /// Render and capture the base catalogue.
    Rendering,
    /// Classify every entry of both catalogues.
    Comparing,
}

/// Terminal boundary of one comparison. It receives each step when the step starts.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StepsMock))]
pub trait Steps: Send + Sync {
    /// Announce the step that starts now.
    fn step(&self, step: Step);
}
