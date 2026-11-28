//! Initialize source roots, exact configuration inputs, and watch rules.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::Path;
use std::time::Duration;

use mokly_catalogue::config_types::{ResolvedConfig, WatchAction};
use mokly_catalogue::globs::{self, GlobSyntax};
use mokly_css::dependencies::DirectoryDependency;

use crate::error::Result;
use crate::event::Action;
use crate::pattern;

use super::Plan;

impl Plan {
    /// Compile one plan before modules run, then extend it with their inventories.
    pub fn new(
        config: &ResolvedConfig,
        sources: &[String],
        directories: &[DirectoryDependency],
        resources: &BTreeSet<String>,
    ) -> Result<Self> {
        let mut plan = Self {
            repository: config.repo_root.clone(),
            debounce: Duration::try_from_secs_f64(
                config
                    .input
                    .watch
                    .as_ref()
                    .and_then(|watch| watch.debounce_ms)
                    .unwrap_or(75.0)
                    .max(0.0)
                    / 1000.0,
            )
            .unwrap_or(Duration::from_secs(86_400))
            .min(Duration::from_secs(86_400)),
            exact: HashMap::new(),
            ancestors: HashMap::new(),
            root_index: HashSet::new(),
            resolution_directories: BTreeMap::new(),
            waypoints: HashSet::new(),
            roots: BTreeSet::new(),
            dependency_roots: BTreeMap::new(),
            source_roots: Vec::new(),
            directories: Vec::new(),
            rules: Vec::new(),
            output: config.repo_root.join("mokly-static"),
        };
        for root in &config.roots {
            if root.pending_storybook() {
                continue;
            }
            let globs = globs::for_root(root)?;
            for path in [&root.directory, &root.identity] {
                plan.roots.insert(path.clone());
                plan.source_roots
                    .push((path.clone(), globs.clone(), root.from_storybook_main()));
            }
        }
        for path in config
            .authored_inputs
            .iter()
            .cloned()
            .chain(sources.iter().map(|path| config.repo_root.join(path)))
        {
            plan.required(path, Action::Rebuild);
        }
        plan.required(config.file.clone(), Action::Config);
        for path in config.storybook_inputs().keys() {
            plan.required(config.repo_root.join(path), Action::Config);
        }
        for directory in directories {
            let path = config.repo_root.join(&directory.path);
            plan.roots.insert(path.clone());
            plan.directories.push((
                path,
                pattern::compile(std::slice::from_ref(&directory.glob), GlobSyntax::Postcss)?,
            ));
        }
        plan.root_index = plan.roots.iter().cloned().collect();
        plan.waypoints = plan
            .roots
            .iter()
            .flat_map(|root| root.ancestors().map(Path::to_owned))
            .collect();
        for rule in config
            .input
            .watch
            .as_ref()
            .and_then(|watch| watch.rules.as_ref())
            .into_iter()
            .flatten()
        {
            if !matches!(rule.action, WatchAction::Ignore) {
                for path in &rule.paths {
                    let root = pattern::rule_root(&config.repo_root, path);
                    if !plan.denied(&root, true) {
                        plan.roots.insert(root);
                    }
                }
            }
            plan.rules.push((
                rule.action,
                pattern::compile(&rule.paths, GlobSyntax::Posix)?,
            ));
        }
        plan.resources(resources);
        Ok(plan)
    }
}
