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
