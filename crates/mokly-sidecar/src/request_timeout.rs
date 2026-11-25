//! Default execution deadlines by request category.

use crate::methods::Call;

impl Call {
    /// Protocol default deadline; the process pool applies environment overrides.
    pub fn timeout_ms(&self) -> u64 {
        match self {
            Self::Bundle(_) | Self::Describe(_) | Self::ReadStorybook(_) => 120_000,
            Self::ProcessCss(_) | Self::TransformViteCss(_) => 60_000,
            _ => 30_000,
        }
    }
}
