//! Stable terminal categories and fixed recovery copy.

/// Stable terminal categories, independent of process exit status.
#[derive(Clone, Copy, Debug)]
pub enum Code {
    /// Catalogue validation or rendering failure.
    BuildInvalid,
    /// Command parsing failure.
    CliInvalid,
    /// Invalid configuration.
    ConfigInvalid,
    /// No configuration found.
    ConfigMissing,
    /// Static output failure.
    ExportInvalid,
    /// Failed publish temporary-root allocation.
    PublishDirectory,
    /// Git command failure.
    GitFailed,
    /// Dirty publication checkout.
    GitUncommitted,
    /// Comparison failure.
    ReviewInvalid,
    /// Server startup failure.
    ServerFailed,
    /// Upload failure.
    UploadFailed,
    /// Publication was cancelled by its owner.
    UploadCancelled,
    /// Upload retries or transport failed.
    UploadTransport,
    /// Invalid upload bundle.
    UploadInvalidBundle,
    /// Upload exceeds receiver limits.
    UploadTooLarge,
    /// Upload credentials rejected.
    UploadUnauthorized,
    /// Receiver does not support the format.
    UploadUnsupportedVersion,
}

impl Code {
    /// Protocol code, headline and recovery hint in that order.
    pub fn presentation(self) -> (&'static str, &'static str, &'static str) {
        match self {
            Self::BuildInvalid => (
                "build-invalid",
                "The catalogue could not be built.",
                "Fix the reported catalogue source and retry.",
            ),
            Self::CliInvalid => (
                "cli-invalid",
                "The command could not be understood.",
                "Run `mokly --help` to see commands.",
            ),
            Self::ConfigInvalid => (
                "config-invalid",
                "The Mokly configuration is invalid.",
                "Fix the reported configuration value and retry.",
            ),
            Self::ConfigMissing => (
                "config-missing",
                "No Mokly configuration was found.",
                "Run inside a consumer repository or pass `--config`.",
            ),
            Self::PublishDirectory => (
                "export-invalid",
                "The publish build directory could not be prepared.",
                "Set TMPDIR, or TMP on Windows, to a writable directory outside the checkout.",
            ),
            Self::ExportInvalid => (
                "export-invalid",
                "The static output could not be written.",
                "Fix the reported output directory or input and retry.",
            ),
            Self::GitFailed => (
                "git-failed",
                "Git information could not be read.",
                "Check the repository and configured base.",
            ),
            Self::GitUncommitted => (
                "git-uncommitted",
                "The checkout has uncommitted changes.",
                "Commit, stash or ignore these files, then publish again.",
            ),
            Self::ReviewInvalid => (
                "review-invalid",
                "The comparison could not be created.",
                "Fix the reported comparison input and retry.",
            ),
            Self::ServerFailed => (
                "server-failed",
                "The catalogue server could not start.",
                "Check the reported port or process and retry.",
            ),
            Self::UploadFailed => (
                "upload-failed",
                "The catalogue could not be published.",
                "Check the endpoint and connection, then retry.",
            ),
            Self::UploadCancelled => (
                "upload-failed",
                "Publication was cancelled.",
                "Run mokly publish again when you are ready.",
            ),
            Self::UploadTransport => (
                "upload-failed",
                "The catalogue upload did not complete.",
                "Check the endpoint and connection, then retry.",
            ),
            Self::UploadInvalidBundle => (
                "upload-invalid-bundle",
                "The catalogue upload is invalid.",
                "Rebuild the catalogue and retry.",
            ),
            Self::UploadTooLarge => (
                "upload-too-large",
                "The catalogue is too large to publish.",
                "Reduce the output size or raise the receiver limit.",
            ),
            Self::UploadUnauthorized => (
                "upload-unauthorized",
                "The catalogue upload was not authorized.",
                "Check the token and repository access.",
            ),
            Self::UploadUnsupportedVersion => (
                "upload-unsupported-version",
                "The receiver does not support this catalogue.",
                "Upgrade the receiver or use a supported Mokly version.",
            ),
        }
    }
}
