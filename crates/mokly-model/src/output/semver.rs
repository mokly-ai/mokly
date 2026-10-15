//! Exact SemVer grammar without a machine-integer bound on numeric identifiers.

pub(crate) fn valid(value: &str) -> bool {
    let (version, build) = value
        .split_once('+')
        .map_or((value, None), |(version, build)| (version, Some(build)));
    if build.is_some_and(|build| !identifiers(build, false)) {
        return false;
    }
    let (core, prerelease) = version
        .split_once('-')
        .map_or((version, None), |(core, prerelease)| {
            (core, Some(prerelease))
        });
    if prerelease.is_some_and(|prerelease| !identifiers(prerelease, true)) {
        return false;
    }
    let parts: Vec<_> = core.split('.').collect();
    parts.len() == 3 && parts.iter().all(|part| numeric(part))
}

fn numeric(value: &str) -> bool {
    !value.is_empty()
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && (value.len() == 1 || !value.starts_with('0'))
}

fn identifiers(value: &str, prerelease: bool) -> bool {
    value.split('.').all(|part| {
        !part.is_empty()
            && part
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            && (!prerelease || !part.bytes().all(|byte| byte.is_ascii_digit()) || numeric(part))
    })
}
