//! Safe relative POSIX glob validation and matching.

use std::collections::BTreeSet;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

/// Default source selection, independent of application layout.
pub(crate) const DEFAULT_GLOBS: [&str; 7] = [
    "**/*.mockup.{ts,tsx}",
    "**/*.stories.{ts,tsx,js,jsx}",
    "**/*.screen.html",
    "**/*.component.html",
    "**/*.page.html",
    "**/*.use-case.yaml",
    "**/*.md",
];

/// Compile safe globs, validating the original and every brace alternative.
pub(crate) fn compile(patterns: &[String]) -> Result<GlobSet, String> {
    let mut builder = GlobSetBuilder::new();
    let mut seen = BTreeSet::new();
    for pattern in patterns {
        if !seen.insert(pattern) {
            return Err(format!("duplicate glob {pattern:?}"));
        }
        validate(pattern)?;
        for expanded in expand(pattern)? {
            validate(&expanded)?;
        }
        let glob = match GlobBuilder::new(pattern)
            .literal_separator(true)
            .backslash_escape(false)
            .build()
        {
            Ok(glob) => glob,
            Err(error) => return Err(format!("invalid glob {pattern:?}: {error}")),
        };
        builder.add(glob);
    }
    match builder.build() {
        Ok(globs) => Ok(globs),
        Err(error) => Err(format!("invalid globs: {error}")),
    }
}

fn validate(pattern: &str) -> Result<(), String> {
    if pattern.trim().is_empty()
        || pattern.starts_with(['!', '#', '/'])
        || pattern
            .chars()
            .any(|c| c == '\\' || c == ':' || c.is_control())
        || pattern
            .split('/')
            .any(|segment| matches!(segment, "" | "." | ".."))
    {
        return Err(format!("not a safe relative POSIX glob: {pattern:?}"));
    }
    Ok(())
}

fn expand(pattern: &str) -> Result<Vec<String>, String> {
    let Some(start) = pattern.find('{') else {
        return Ok(vec![pattern.into()]);
    };
    let mut depth = 0;
    let mut separators = Vec::new();
    let mut end = None;
    for (offset, c) in pattern[start..].char_indices() {
        match c {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = Some(start + offset);
                    break;
                }
            }
            ',' if depth == 1 => separators.push(start + offset),
            _ => {}
        }
    }
    let Some(end) = end else {
        return Err(format!("unclosed brace in glob {pattern:?}"));
    };
    let mut alternatives = Vec::new();
    let mut previous = start + 1;
    for stop in separators.into_iter().chain([end]) {
        let next = format!(
            "{}{}{}",
            &pattern[..start],
            &pattern[previous..stop],
            &pattern[end + 1..]
        );
        alternatives.extend(expand(&next)?);
        previous = stop + 1;
    }
    Ok(alternatives)
}

/// Discovery directory denials apply below each explicit root only.
pub(crate) fn denied_directory(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "coverage"
            | "target"
            | "test-results"
            | "playwright-report"
            | ".context"
    )
}
