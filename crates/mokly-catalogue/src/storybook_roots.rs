//! Expand Storybook-owned roots before discovery on either source tree.

use std::collections::btree_map::Entry;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::{invalid_path_text, normalize, relative};
use crate::config_types::{ResolvedConfig, ResolvedRoot};
use crate::config_validation::invalid;
use crate::error::Result;
use crate::storybook_globs;

/// Repository-relative Storybook folder and the provenance of an expanded root.
#[derive(Clone, Debug, PartialEq)]
pub struct ResolvedStorybook {
    folder: String,
    configured_index: Option<usize>,
    entry: Option<MainEntry>,
}

#[derive(Clone, Debug, PartialEq)]
struct MainEntry {
    main: Arc<MainFile>,
    index: usize,
}

#[derive(Debug, PartialEq)]
struct MainFile {
    path: String,
    inputs: BTreeMap<String, Option<String>>,
}

impl ResolvedStorybook {
    /// Repository-relative POSIX folder, empty for the repository itself.
    pub fn as_str(&self) -> &str {
        &self.folder
    }
}

impl From<&str> for ResolvedStorybook {
    fn from(folder: &str) -> Self {
        folder.to_owned().into()
    }
}

impl From<String> for ResolvedStorybook {
    fn from(folder: String) -> Self {
        Self {
            folder,
            configured_index: None,
            entry: None,
        }
    }
}

impl ResolvedRoot {
    /// Whether this root comes from an entry of the main file's stories array.
    pub fn from_storybook_main(&self) -> bool {
        self.storybook.entry.is_some()
    }

    /// Whether this root still needs its main file evaluated.
    pub fn pending_storybook(&self) -> bool {
        self.input.dir.is_empty() && !self.from_storybook_main()
    }

    /// Index of the configured root that owns this effective root.
    pub(crate) fn configured_index(&self, effective_index: usize) -> usize {
        self.storybook.configured_index.unwrap_or(effective_index)
    }

    /// Main file path and authored stories index of an expanded root.
    pub(crate) fn storybook_entry(&self) -> Option<(&str, usize)> {
        let entry = self.storybook.entry.as_ref()?;
        Some((&entry.main.path, entry.index))
    }
}

impl ResolvedConfig {
    /// Whether the loaded configuration needs Storybook before discovery.
    pub fn needs_storybook(&self) -> bool {
        self.roots.iter().any(ResolvedRoot::pending_storybook)
    }

    /// Local configuration digests and absent main candidates of the effective roots.
    pub fn storybook_inputs(&self) -> BTreeMap<&str, Option<&str>> {
        self.roots
            .chunk_by(|left, right| {
                left.storybook.configured_index == right.storybook.configured_index
            })
            .filter_map(|roots| roots.first()?.storybook.entry.as_ref())
            .flat_map(|entry| {
                entry
                    .main
                    .inputs
                    .iter()
                    .map(|(path, digest)| (path.as_str(), digest.as_deref()))
            })
            .collect()
    }
}

/// One stories entry normalized by Storybook before Mokly validates the pattern.
pub struct StorybookEntry {
    /// Directory relative to the source root.
    pub directory: String,
    /// Pattern relative to that directory.
    pub files: String,
}

/// The entries and local input digests from one selected main file.
pub struct StorybookStories {
    /// Main file path relative to the source root.
    pub main: String,
    /// Entries in authored order.
    pub entries: Vec<StorybookEntry>,
    /// Content digests and absent candidates under repository-relative POSIX paths.
    pub inputs: BTreeMap<String, Option<String>>,
}

/// Read Storybook configuration with the runtime of the selected source side.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StorybookReaderMock))]
pub trait StorybookReader: Send + Sync {
    /// Run one main file and return its stories entries.
    fn read(&self, config: &ResolvedConfig, folder: &str) -> Result<StorybookStories>;
}

/// Replace each pending root with its ordered entries and retain the local inputs.
pub fn expand(
    config: &mut ResolvedConfig,
    tree: &dyn SourceTree,
    reader: &dyn StorybookReader,
) -> Result<()> {
    if !config.needs_storybook() {
        return Ok(());
    }
    let mut loaded = BTreeMap::new();
    let mut expanded = Vec::new();
    for (index, root) in config.roots.iter().enumerate() {
        let mut root = root.clone();
        root.storybook.configured_index = Some(index);
        if !root.pending_storybook() {
            expanded.push(root);
            continue;
        }

        let folder = root.storybook.as_str();
        let (entries, main) = match loaded.entry(folder.to_owned()) {
            Entry::Occupied(entry) => entry.into_mut(),
            Entry::Vacant(entry) => {
                let stories = reader.read(config, folder)?;
                let main = Arc::new(MainFile {
                    path: stories.main,
                    inputs: with_projected_inputs(tree, &config.repo_root, stories.inputs),
                });
                entry.insert((stories.entries, main))
            }
        };
        if entries.is_empty() {
            return Err(invalid(format!(
                "root matches no file: {}",
                display_folder(folder)
            )));
        }
        for (entry_index, entry) in entries.iter().enumerate() {
            let error = |reason: String| {
                invalid(format!("{}: stories[{entry_index}]: {reason}", main.path))
            };
            let (directory, identity) =
                project(tree, &config.repo_root, &entry.directory).map_err(error)?;
            let patterns = storybook_globs::patterns(&entry.files).map_err(error)?;
            let mut effective = root.clone();
            effective.storybook.entry = Some(MainEntry {
                main: main.clone(),
                index: entry_index,
            });
            effective.input.files = Some(patterns);
            effective.directory = directory;
            effective.identity = identity;
            expanded.push(effective);
        }
    }
    let mut known: BTreeSet<_> = config.authored_inputs.iter().cloned().collect();
    for (_, main) in loaded.values() {
        for (path, _) in main.inputs.iter().filter(|(_, digest)| digest.is_some()) {
            let path = config.repo_root.join(path);
            if known.insert(path.clone()) {
                config.authored_inputs.push(path);
            }
        }
    }
    config.roots = expanded;
    Ok(())
}

fn with_projected_inputs(
    tree: &dyn SourceTree,
    root: &Path,
    mut inputs: BTreeMap<String, Option<String>>,
) -> BTreeMap<String, Option<String>> {
    let projected: Vec<_> = inputs
        .iter()
        .filter_map(|(name, digest)| {
            let digest = digest.as_ref()?;
            let node = tree.project(&root.join(name)).ok().flatten()?;
            (node.kind == FileKind::File && node.identity.starts_with(root))
                .then(|| (relative(&node.identity, root), digest.clone()))
        })
        .collect();
    for (name, digest) in projected {
        inputs.entry(name).or_insert(Some(digest));
    }
    inputs
}

pub(crate) fn display_folder(folder: &str) -> &str {
    if folder.is_empty() { "." } else { folder }
}

fn project(
    tree: &dyn SourceTree,
    root: &Path,
    entry: &str,
) -> std::result::Result<(PathBuf, PathBuf), String> {
    let directory = normalize(&root.join(entry));
    if invalid_path_text(entry) {
        return Err(format!("invalid directory {entry:?}"));
    }
    if !directory.starts_with(root) {
        return Err(format!("directory {entry:?} is outside repoRoot"));
    }
    let display = relative(&directory, root);
    for prefix in directory
        .ancestors()
        .take_while(|path| path.starts_with(root))
    {
        let node = match tree.project(prefix) {
            Ok(Some(node)) => node,
            Ok(None) => continue,
            Err(error) if error.is_vanished() => continue,
            Err(error) => return Err(format!("directory {display}: {}", error.code())),
        };
        if node.kind == FileKind::Symlink {
            let link = relative(prefix, root);
            return Err(format!(
                "directory {display} uses the symbolic link {link}; name the target path instead"
            ));
        }
        if !node.identity.starts_with(root) {
            return Err(format!("directory {display} is outside repoRoot"));
        }
        let identity = match directory.strip_prefix(prefix) {
            Ok(suffix) if !suffix.as_os_str().is_empty() => node.identity.join(suffix),
            _ => node.identity,
        };
        return Ok((directory, identity));
    }
    Ok((directory.clone(), directory))
}
