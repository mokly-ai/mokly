//! Pure completion summaries of build and publish.

use std::time::Duration;

use mokly_cli::output::{Mode, Style};
use mokly_publish::accounting::Receipt;
use mokly_publish::completion::Outcome;

use crate::phase_format::{duration, success};

/// Format the build summary for an already safe output directory.
pub(super) fn built(style: &Style, directory: &str, files: usize, elapsed: Duration) -> String {
    if style.mode == Mode::Plain {
        format!("Built Mokly to {directory} ({files} files).\n")
    } else {
        success(
            style,
            &format!(
                "Built Mokly to {directory} · {files} files ({})",
                duration(elapsed)
            ),
        )
    }
}

/// Format the publish summary of one completed exchange.
pub(super) fn published(style: &Style, receipt: &Receipt, elapsed: Duration) -> String {
    if style.mode == Mode::Plain {
        return format!("{}\n", receipt.summary());
    }
    let message = if receipt.completion.outcome == Outcome::AlreadyPublished {
        "Mokly catalogue already published for this commit".into()
    } else {
        format!(
            "Published Mokly catalogue · {} {} uploaded, {} unchanged",
            receipt.uploaded,
            if receipt.uploaded == 1 {
                "file"
            } else {
                "files"
            },
            receipt.unchanged
        )
    };
    success(style, &format!("{message} ({})", duration(elapsed)))
}
