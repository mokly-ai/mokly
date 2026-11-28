//! Portable delivery routes and confined stylesheet-relative asset paths.

use mokly_model::paths::is_windows_device_name;
use mokly_model::routes;

/// Build a generated route from a logical path.
pub fn route(namespace: &str, path: &str) -> String {
    let mut route = String::with_capacity(namespace.len() + 1 + path.len());
    route.push_str(namespace);
    for part in path.split('/') {
        route.push('/');
        if let Some(name) = part
            .strip_prefix('.')
            .filter(|_| !matches!(part, "." | ".."))
        {
            route.push_str("dot-");
            route.push_str(name);
        } else {
            route.push_str(part);
        }
    }
    route
}

/// Check an imported CSS or asset route before it becomes public.
pub fn portable(path: &str, asset: bool) -> bool {
    let mut parents = ["", "", ""];
    path.split('/').all(|part| {
        let scope_allowed = parents[2] == "node_modules"
            || matches!(
                parents,
                ["node_modules", "dot-mokly-roots", index]
                    if !index.is_empty()
                        && !index.starts_with('0')
                        && index.bytes().all(|byte| byte.is_ascii_digit())
            );
        let name = if scope_allowed {
            part.strip_prefix('@').unwrap_or(part)
        } else {
            part
        };
        parents.rotate_left(1);
        parents[2] = part;
        !name.is_empty()
            && name
                .as_bytes()
                .first()
                .is_some_and(|c| c.is_ascii_alphanumeric() || (!asset && b"_-".contains(c)))
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"._~-".contains(&c))
            && !name.ends_with('.')
            && !is_windows_device_name(name.split('.').next().unwrap_or(name))
    })
}

/// Relative authored path, confined to the repository namespace.
pub fn resolve(stylesheet: &str, url: &str) -> Option<String> {
    routes::resolve(stylesheet, url)
}

/// URL forms that never enter local asset delivery.
pub fn external(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("http:")
        || lower.starts_with("https:")
        || lower.starts_with("data:")
        || value.starts_with("//")
        || value.starts_with('#')
}
