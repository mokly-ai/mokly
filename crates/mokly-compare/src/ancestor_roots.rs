//! Configuration ancestor package roots in Node lookup order.

use std::path::Path;

/// Repository-relative directories, nearest first and repository root last.
pub fn directories(configuration_directory: &str) -> Vec<String> {
    Path::new(configuration_directory)
        .ancestors()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .map(|path| if path == "." { String::new() } else { path })
        .fold(Vec::new(), |mut roots, path| {
            if !roots.contains(&path) {
                roots.push(path);
            }
            roots
        })
}

/// Repository-relative package roots of one side: the configuration ancestors in Node's
/// order, then each configured root that no ancestor already names. Head and base
/// sides use this one rule, so equal configurations select equal roots.
pub fn package_roots(
    configuration_directory: &str,
    configured: impl IntoIterator<Item = String>,
) -> Vec<String> {
    let mut roots = directories(configuration_directory);
    for root in configured {
        if !roots.contains(&root) {
            roots.push(root);
        }
    }
    roots
}

/// Logical graph prefix for one canonical selected dependency directory.
pub fn logical(index: usize) -> String {
    if index == 0 {
        "node_modules".into()
    } else {
        format!("node_modules/.mokly-roots/{index}")
    }
}

/// Lexical repository dependency directory, including a nested importer directory.
pub fn dependency_directory(path: &str) -> Option<String> {
    let parts: Vec<_> = path.split('/').collect();
    if parts
        .iter()
        .any(|part| part.is_empty() || matches!(*part, "." | "..") || part.contains('\\'))
    {
        return None;
    }
    let index = parts.iter().position(|part| *part == "node_modules")?;
    Some(parts[..=index].join("/"))
}
