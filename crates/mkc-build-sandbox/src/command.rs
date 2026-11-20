//! Pure argument construction and shell quoting for display only.

use std::collections::BTreeMap;

use mkc_build_interface::request::BuildRequest;

pub(crate) const REPO: &str = "/workspace/repo";
pub(crate) const CREDENTIAL: &str = "/home/user/.mokly-git-credentials";
pub(crate) const OUTPUT_LIMIT: usize = 64 * 1024 * 1024;

/// Direct executable and arguments; never evaluated by a shell.
pub(crate) struct Command {
    pub(crate) program: String,
    pub(crate) args: Vec<String>,
    pub(crate) cwd: String,
    pub(crate) publish: bool,
    pub(crate) capture_stdout: bool,
}

impl Command {
    pub(crate) fn new(program: &str, args: Vec<String>, cwd: &str) -> Self {
        Self {
            program: program.into(),
            args,
            cwd: cwd.into(),
            publish: false,
            capture_stdout: false,
        }
    }

    pub(crate) fn probe(mut self) -> Self {
        self.capture_stdout = true;
        self
    }

    pub(crate) fn environment(&self, request: &BuildRequest) -> BTreeMap<String, String> {
        let mut envs = [
            ("CI", "1"),
            ("NO_COLOR", "1"),
            ("FORCE_COLOR", "0"),
            ("GIT_TERMINAL_PROMPT", "0"),
            ("COREPACK_ENABLE_DOWNLOAD_PROMPT", "0"),
        ]
        .into_iter()
        .map(|(key, value)| (key.into(), value.into()))
        .collect::<BTreeMap<_, _>>();
        if self.publish {
            envs.insert(
                "MOKLY_ENDPOINT".into(),
                request.upload_endpoint.as_str().into(),
            );
            envs.insert("MOKLY_TOKEN".into(), request.upload_token.expose().into());
        }
        envs
    }

    pub(crate) fn contains_credential(&self, request: &BuildRequest) -> bool {
        [
            request.upload_token.expose(),
            request.installation_token.expose(),
        ]
        .iter()
        .any(|token| {
            self.program.contains(token)
                || self.cwd.contains(token)
                || self.args.iter().any(|arg| arg.contains(token))
        })
    }

    pub(crate) fn display(&self) -> String {
        let arguments = self.args.iter().map(String::as_str);
        let argv = [self.program.as_str()]
            .into_iter()
            .chain(arguments)
            .map(quote)
            .collect::<Vec<_>>();
        format!("$ {}\n", argv.join(" "))
    }
}

pub(crate) fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).into()).collect()
}

pub(crate) fn directory(relative: &str) -> String {
    if relative.is_empty() {
        REPO.into()
    } else {
        format!("{REPO}/{relative}")
    }
}

pub(crate) fn directories(config: &str) -> Vec<String> {
    let mut current = config.rsplit_once('/').map_or("", |(parent, _)| parent);
    let mut result = vec![current.to_owned()];
    while !current.is_empty() {
        current = current.rsplit_once('/').map_or("", |(parent, _)| parent);
        result.push(current.to_owned());
    }
    result
}

fn quote(value: &str) -> String {
    if !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"@%+=:,./_-".contains(&byte))
    {
        value.into()
    } else {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}

#[cfg(test)]
#[path = "_tests_/command_tests.rs"]
mod command_tests;
