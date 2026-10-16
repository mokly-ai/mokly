//! Node package-directory order across authored and virtual dependency roots.

use std::path::Path;

use crate::resolution::Resolution;

pub(crate) fn roots(importer: &str, settings: &Resolution) -> Vec<String> {
    let logical = std::iter::once("node_modules")
        .chain(settings.dependency_roots.iter().map(String::as_str))
        .chain(settings.dependency_aliases.values().map(String::as_str))
        .filter(|root| {
            importer
                .strip_prefix(root)
                .is_some_and(|rest| rest.starts_with('/'))
        })
        .max_by_key(|root| root.len());
    let mut roots = Vec::new();
    let mut directory = Path::new(importer).parent();
    while let Some(base) = directory {
        let text = base.to_string_lossy().replace('\\', "/");
        if Some(text.as_str()) == logical {
            push(&mut roots, text.clone());
            let authored = settings
                .dependency_aliases
                .iter()
                .filter(|(_, value)| **value == text)
                .max_by_key(|(name, _)| name.len())
                .map_or(text.as_str(), |(name, _)| name.as_str());
            ancestors(
                Path::new(authored).parent().and_then(Path::parent),
                settings,
                &mut roots,
            );
            break;
        }
        if base.file_name().is_none_or(|name| name != "node_modules") {
            append(base, settings, &mut roots);
        }
        directory = base.parent();
    }
    for root in &settings.dependency_roots {
        push(&mut roots, root.clone());
    }
    roots
}
fn ancestors(mut directory: Option<&Path>, settings: &Resolution, roots: &mut Vec<String>) {
    while let Some(base) = directory {
        if base.file_name().is_none_or(|name| name != "node_modules") {
            append(base, settings, roots);
        }
        directory = base.parent();
    }
}
fn append(base: &Path, settings: &Resolution, roots: &mut Vec<String>) {
    let authored = base
        .join("node_modules")
        .to_string_lossy()
        .replace('\\', "/");
    push(
        roots,
        settings
            .dependency_aliases
            .get(&authored)
            .unwrap_or(&authored)
            .clone(),
    );
}
fn push(roots: &mut Vec<String>, root: String) {
    if !roots.contains(&root) {
        roots.push(root);
    }
}
