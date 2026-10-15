//! Npm workspace inclusion, exclusion and directory-derived package names.

use globset::{GlobBuilder, GlobMatcher};

use crate::error::{Error, Result};
use crate::manifest;

struct Pattern {
    source: String,
    matcher: GlobMatcher,
}

pub(crate) struct Workspaces {
    positive: Vec<Pattern>,
    negative: Vec<Pattern>,
}

impl Workspaces {
    pub(crate) fn new(parent: &str, patterns: &[String]) -> Result<Self> {
        let mut positive = Vec::new();
        let mut negative: Vec<Pattern> = Vec::new();
        for value in patterns {
            let count = value.len() - value.trim_start_matches('!').len();
            let value = &value[count..];
            let value = value
                .strip_prefix("./")
                .unwrap_or(value)
                .trim_start_matches('/');
            let Ok(source) = manifest::target(parent, value) else {
                continue;
            };
            let matcher = match GlobBuilder::new(&source).literal_separator(true).build() {
                Ok(glob) => glob.compile_matcher(),
                Err(_) => return Err(Error::InvalidInput { path: source }),
            };
            if count % 2 == 1 {
                negative.push(Pattern { source, matcher });
            } else {
                negative.retain(|pattern| !pattern.matcher.is_match(&source));
                positive.push(Pattern { source, matcher });
            }
        }
        positive.retain(|pattern: &Pattern| {
            !negative
                .iter()
                .any(|excluded| excluded.matcher.is_match(&pattern.source))
        });
        Ok(Self { positive, negative })
    }

    pub(crate) fn matches(&self, directory: &str) -> bool {
        self.positive
            .iter()
            .any(|pattern| pattern.matcher.is_match(directory))
            && !self
                .negative
                .iter()
                .any(|pattern| pattern.matcher.is_match(directory))
    }
}

pub(crate) fn name(directory: &str) -> String {
    let mut parts = directory.rsplit('/');
    let leaf = parts.next().unwrap_or("");
    match parts.next() {
        Some(scope) if scope.starts_with('@') => format!("{scope}/{leaf}"),
        _ => leaf.to_owned(),
    }
}
