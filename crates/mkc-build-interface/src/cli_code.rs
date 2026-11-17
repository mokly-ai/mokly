//! Typed public Mokly CLI failure codes used by build lifecycle policy.

/// Last recognized plain stderr failure category from the published CLI.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MoklyCliCode {
    /// The upload exchange did not finish successfully.
    UploadFailed,
    /// The checkout has uncommitted files that Git does not ignore.
    GitUncommitted,
    /// A valid CLI error prefix names a code the cloud does not map.
    Unrecognized,
}

impl MoklyCliCode {
    /// Convert an observed public CLI code at the sandbox boundary.
    pub fn parse(code: &str) -> Self {
        match code {
            "upload-failed" => Self::UploadFailed,
            "git-uncommitted" => Self::GitUncommitted,
            _ => Self::Unrecognized,
        }
    }
}
