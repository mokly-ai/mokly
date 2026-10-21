//! Yarn Berry Git and GitHub sources, which keep the fallback tier.
//!
//! Berry clones a Git source, or downloads a GitHub archive, and then packs
//! it with its own scripts, so a base install never fetches one. The forms
//! follow Berry's Git and GitHub detection. The bare `owner/repo` shorthand
//! counts only in a range position, because lockfile checksums share its
//! spelling.

/// Whether a Berry range names a Git or GitHub source.
pub(crate) fn git(range: &str, shorthand: bool) -> bool {
    let head = range.split('#').next().unwrap_or(range);
    if ["ssh:", "git:", "git@", "github:"]
        .iter()
        .any(|prefix| range.starts_with(prefix))
        || range
            .strip_prefix("git+")
            .is_some_and(|rest| rest.contains(':'))
    {
        return true;
    }
    let url = head.strip_prefix("git+").unwrap_or(head);
    if let Some(rest) = url
        .strip_prefix("https:")
        .or_else(|| url.strip_prefix("http:"))
    {
        let authority = rest.strip_prefix("//").unwrap_or("");
        let host = authority.split('/').next().unwrap_or("");
        let host = host.rsplit('@').next().unwrap_or(host);
        if host.eq_ignore_ascii_case("github.com") || (head.ends_with(".git") && rest.contains('/'))
        {
            return true;
        }
    }
    shorthand && owner_repository(head)
}

fn owner_repository(head: &str) -> bool {
    let Some((owner, repository)) = head.split_once('/') else {
        return false;
    };
    let part = |value: &str| {
        !value.is_empty()
            && !matches!(value, "." | "..")
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    };
    part(owner) && part(repository)
}
