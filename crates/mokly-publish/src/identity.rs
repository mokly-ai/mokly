//! GitHub Actions revision context read by the publication command.

/// Environment values read once by the CLI composition root.
#[derive(Clone, Debug, Default)]
pub struct ActionsContext {
    /// GITHUB_ACTIONS, interpreted only when exactly true.
    pub actions: Option<String>,
    /// GITHUB_HEAD_REF for a pull request.
    pub head_ref: Option<String>,
    /// GITHUB_REF_TYPE for a branch run.
    pub ref_type: Option<String>,
    /// GITHUB_REF_NAME for a branch run.
    pub ref_name: Option<String>,
    /// GITHUB_REF for the optional pull request number.
    pub git_ref: Option<String>,
}

impl ActionsContext {
    /// Resolve the branch name without replacing the actual checked-out SHA.
    pub fn branch(&self, symbolic: &str) -> String {
        if self.actions.as_deref() == Some("true") {
            if let Some(head) = self.head_ref.as_ref().filter(|value| !value.is_empty()) {
                return head.clone();
            }
            if self.ref_type.as_deref() == Some("branch")
                && let Some(name) = self.ref_name.as_ref().filter(|value| !value.is_empty())
            {
                return name.clone();
            }
        }
        if symbolic.is_empty() {
            "HEAD".to_owned()
        } else {
            symbolic.to_owned()
        }
    }

    /// A positive JavaScript-safe pull request number, only in Actions.
    pub fn pull_request(&self) -> Option<u64> {
        if self.actions.as_deref() != Some("true") {
            return None;
        }
        let value = self.git_ref.as_deref()?.strip_prefix("refs/pull/")?;
        let (number, kind) = value.split_once('/')?;
        if number.starts_with('0')
            || !matches!(kind, "merge" | "head")
            || !number.bytes().all(|byte| byte.is_ascii_digit())
        {
            return None;
        }
        number
            .parse::<u64>()
            .ok()
            .filter(|number| (1..=9_007_199_254_740_991).contains(number))
    }
}
