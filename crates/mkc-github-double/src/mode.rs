//! Scenario state and expected App credentials shared with the running double.

use mkc_domain::app_paths::GITHUB_CALLBACK;
use serde_json::Value;

/// A callback run once, under the scenario lock, while one request is answered.
///
/// Scenarios use it to change the world between a provider read and the API's
/// next step, for example to race a webhook against a branch read.
pub type Hook = Box<dyn FnOnce() + Send>;

/// Mutable scenario state consulted while answering each request.
///
/// Every field is a deliberate deviation from the recordings; the defaults
/// replay one installed public repository for the fixture App.
pub struct Mode {
    /// Origin the token exchange must present as its redirect target.
    pub app_origin: String,
    /// App ID the check-run list must filter by.
    pub app_id: u64,
    /// Client ID the token exchange must present.
    pub client_id: String,
    /// Client secret the token exchange must present.
    pub client_secret: String,
    /// Check runs created so far, as GitHub stores them.
    pub check_runs: Vec<Value>,
    /// Check runs created so far.
    pub check_creates: usize,
    /// Check-run updates answered so far.
    pub check_updates: usize,
    /// Check-run lists answered so far.
    pub check_lists: usize,
    /// Create the next check run, then lose its answer.
    pub lose_create_response: bool,
    /// Drop the current request without an answer; set by a lost create.
    pub drop_check_response: bool,
    /// Answer the repository list as empty.
    pub no_repositories: bool,
    /// Answer installation reads as absent.
    pub uninstalled: bool,
    /// Report the installation as suspended.
    pub suspended: bool,
    /// Include a second installation on the fixture-org GitHub organization.
    pub second_installation: bool,
    /// Report the second installation as suspended.
    pub second_suspended: bool,
    /// Full name to report for the second installation's selected repository.
    pub second_repository_name: Option<String>,
    /// Answer every branch read for the branch it names.
    pub exact_branch_reads: bool,
    /// Answer branch reads with this failure status.
    pub branch_status: Option<u16>,
    /// Fail the next branch read once with a temporary provider failure.
    pub fail_next_branch: bool,
    /// Report branch reads as absent.
    pub branch_deleted: bool,
    /// Installation tokens minted so far.
    pub token_requests: usize,
    /// Repository-scoped installation tokens minted so far.
    pub scoped_token_requests: usize,
    /// Percent-encoded branch that branch reads redirect to.
    pub branch_name: Option<String>,
    /// Head commit to report for the pull request and its branch.
    pub head_sha: Option<String>,
    /// Report the pull request's head as a fork.
    pub fork_pull: bool,
    /// Report the pull request's head repository as deleted.
    pub missing_pull_repository: bool,
    /// Report the pull request as closed.
    pub closed_pull: bool,
    /// Authorization code exchanges so far.
    pub oauth_requests: usize,
    /// Primary email to report instead of the recorded one.
    pub primary_email: Option<String>,
    /// Full name to report for the first installed repository.
    pub repository_name: Option<String>,
    /// Default branch to report for the first installed repository.
    pub default_branch: Option<String>,
    /// Provider ID to report for the first installed repository.
    pub repository_id: Option<i64>,
    /// Report the installation as covering every repository.
    pub all_repositories: bool,
    /// Report the first installed repository as private.
    pub private: bool,
    /// Repository lists answered so far.
    pub repository_requests: usize,
    /// Every branch target requested, in order.
    pub branch_paths: Vec<String>,
    /// Run once while the next branch read is answered.
    pub branch_hook: Option<Hook>,
    /// Run once while the next pull request read is answered.
    pub pull_hook: Option<Hook>,
    /// Run once while the next check run update is answered, before it applies.
    pub check_update_hook: Option<Hook>,
}

impl Default for Mode {
    fn default() -> Self {
        Self {
            app_origin: "https://app.example.com".to_owned(),
            app_id: 123,
            client_id: "Iv1.fixture".to_owned(),
            client_secret: "fixture-client-secret".to_owned(),
            check_runs: Vec::new(),
            check_creates: 0,
            check_updates: 0,
            check_lists: 0,
            lose_create_response: false,
            drop_check_response: false,
            no_repositories: false,
            uninstalled: false,
            suspended: false,
            second_installation: false,
            second_suspended: false,
            second_repository_name: None,
            exact_branch_reads: false,
            branch_status: None,
            fail_next_branch: false,
            branch_deleted: false,
            token_requests: 0,
            scoped_token_requests: 0,
            branch_name: None,
            head_sha: None,
            fork_pull: false,
            missing_pull_repository: false,
            closed_pull: false,
            oauth_requests: 0,
            primary_email: None,
            repository_name: None,
            default_branch: None,
            repository_id: None,
            all_repositories: false,
            private: false,
            repository_requests: 0,
            branch_paths: Vec::new(),
            branch_hook: None,
            pull_hook: None,
            check_update_hook: None,
        }
    }
}

impl Mode {
    /// The exact redirect target the token exchange must present.
    pub(crate) fn redirect_uri(&self) -> String {
        format!("{}{GITHUB_CALLBACK}", self.app_origin)
    }

    /// The installed repository's current full name.
    pub(crate) fn repository(&self) -> &str {
        self.repository_name
            .as_deref()
            .unwrap_or("octocat/Hello-World")
    }
}
