//! Resolve TypeScript build and source folders in the selected package.

use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::slice;

use jsonc_parser::{ParseOptions, parse_to_serde_value};
use mokly_source_interface::tree::SourceTree;
use serde_json::Value;

use crate::workspace_sources::regular_file;

type Settings = BTreeMap<&'static str, Option<PathBuf>>;

/// Read both layout settings, including relative configuration extensions.
pub(crate) fn folders(
    tree: &dyn SourceTree,
    repo: &Path,
    package: &Path,
) -> Option<(PathBuf, PathBuf)> {
    let mut reader = Configurations {
        tree,
        repo,
        package,
        seen: BTreeMap::new(),
    };
    let mut settings = reader.read(&package.join("tsconfig.json"), 0)?;
    let build = settings.remove("outDir")??;
    let source = settings.remove("rootDir")??;
    (build.starts_with(package) && source.starts_with(package)).then_some((build, source))
}

struct Configurations<'a> {
    tree: &'a dyn SourceTree,
    repo: &'a Path,
    package: &'a Path,
    seen: BTreeMap<PathBuf, Settings>,
}

impl Configurations<'_> {
    fn read(&mut self, file: &Path, depth: usize) -> Option<Settings> {
        if depth >= 32 {
            return None;
        }
        if let Some(settings) = self.seen.get(file) {
            return Some(settings.clone());
        }
        let settings = self.options(file, depth)?;
        self.seen.insert(file.into(), settings.clone());
        Some(settings)
    }

    fn options(&mut self, file: &Path, depth: usize) -> Option<Settings> {
        let canonical = regular_file(self.tree, self.repo, file)?;
        let directory = canonical.parent()?;
        let bytes = self.tree.read(&canonical).ok()?;
        let text = str::from_utf8(&bytes).ok()?.trim_start_matches('\u{feff}');
        let config: Value = parse_to_serde_value(text, &TSCONFIG_SYNTAX).ok()?;
        let config = config.as_object()?;
        let references = match config.get("extends") {
            None => &[],
            Some(Value::Array(references)) => references.as_slice(),
            Some(reference) => slice::from_ref(reference),
        };
        let mut result = Settings::new();
        for reference in references {
            let reference = reference.as_str().filter(|path| path.starts_with('.'))?;
            let mut target = joined(directory, reference);
            if regular_file(self.tree, self.repo, &target).is_none() {
                target.as_mut_os_string().push(".json");
            }
            result.extend(self.read(&target, depth + 1)?);
        }
        if let Some(options) = config.get("compilerOptions") {
            let options = options.as_object()?;
            for key in ["outDir", "rootDir"] {
                if let Some(value) = options.get(key) {
                    result.insert(
                        key,
                        value.as_str().map(|value| self.folder(directory, value)),
                    );
                }
            }
        }
        Some(result)
    }

    fn folder(&self, directory: &Path, value: &str) -> PathBuf {
        if let Some(relative) = value.strip_prefix("${configDir}") {
            joined(self.package, &format!("./{relative}"))
        } else {
            joined(directory, value)
        }
    }
}

fn joined(directory: &Path, value: &str) -> PathBuf {
    let mut path = PathBuf::new();
    for component in directory.join(value).components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                path.pop();
            }
            component => path.push(component),
        }
    }
    path
}

const TSCONFIG_SYNTAX: ParseOptions = ParseOptions {
    allow_comments: true,
    allow_trailing_commas: true,
    allow_loose_object_property_names: false,
    allow_missing_commas: false,
    allow_single_quoted_strings: false,
    allow_hexadecimal_numbers: false,
    allow_unary_plus_numbers: false,
    allow_bare_decimal_point_numbers: false,
    allow_non_finite_numbers: false,
    allow_extended_string_escapes: false,
};
