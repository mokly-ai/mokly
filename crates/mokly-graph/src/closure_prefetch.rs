//! Batch only known, confined closure targets without guessing adjacent Git files.

use std::collections::BTreeSet;

use crate::closure::Walker;
use crate::error::{Result, invalid};
use crate::references::ResourceReference;
use crate::urls::local_target;

pub(crate) fn prefetch(
    walker: &Walker,
    source: &str,
    references: &[ResourceReference],
) -> Result<()> {
    urls(
        walker,
        source,
        &references
            .iter()
            .map(|reference| reference.url.clone())
            .collect::<Vec<_>>(),
    )
}

pub(crate) fn urls(walker: &Walker, source: &str, urls: &[String]) -> Result<()> {
    let mut paths = BTreeSet::new();
    for url in urls {
        let Ok(Some(route)) = local_target(source, url) else {
            continue;
        };
        if route.starts_with("static/mokly-generated/")
            || walker.index.get(&route).is_some()
            || !(route.ends_with(".css") || route.ends_with(".html") || route.ends_with(".htm"))
        {
            continue;
        }
        if let Some(path) = route.strip_prefix("static/")
            && let Ok(file) = walker.policy.check(path)
        {
            paths.insert(file.absolute);
        }
    }
    if paths.is_empty() {
        return Ok(());
    }
    match walker.tree.prefetch(&paths.into_iter().collect::<Vec<_>>()) {
        Ok(()) => Ok(()),
        Err(error) => Err(invalid(
            source,
            format!("resource prefetch failed: {error}"),
        )),
    }
}
