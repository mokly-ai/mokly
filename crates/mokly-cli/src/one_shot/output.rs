//! Durable one-shot results and publication recovery paths.

use std::path::Path;
use std::time::Duration;

use mokly_catalogue::config::relative;
use mokly_cli::publication::command::BuildReporter;
use mokly_cli::recovery_output;
use mokly_model::output::artifact::Artifact;
use mokly_publish::accounting::Receipt;

use crate::one_shot_summary;

use super::Lines;

impl Lines {
    pub(crate) fn built(&self, artifact: &Artifact, root: &Path, elapsed: Duration) {
        let directory = self.redactor.safe(&relative(&artifact.directory, root));
        self.terminal.stdout(&one_shot_summary::built(
            &self.style,
            &directory,
            artifact.files.len(),
            elapsed,
        ));
        self.terminal
            .stdout("Deploy this directory at your site's root with your hosting provider.\n");
    }
    pub(crate) fn published(&self, receipt: &Receipt, elapsed: Duration) {
        self.clear();
        self.terminal
            .stdout(&one_shot_summary::published(&self.style, receipt, elapsed));
        if let Some(url) = &receipt.completion.viewer_url {
            self.terminal
                .stdout(&format!("{}\n", self.redactor.safe(url)));
        }
    }
}
impl BuildReporter for Lines {
    fn retained_directory(&self, directory: &Path) {
        self.clear();
        let path = recovery_output::path(directory, &self.cwd, &self.redactor);
        self.terminal
            .stderr(&recovery_output::retained_publication(&self.style, &path));
    }

    fn build_directory(&self, directory: &Path) {
        self.terminal.stdout(&format!(
            "Mokly publish build: {}\n",
            recovery_output::path(directory, &self.cwd, &self.redactor)
        ));
    }
}
