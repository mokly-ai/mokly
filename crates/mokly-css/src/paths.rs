//! Portable delivery routes and confined stylesheet-relative asset paths.

use mokly_model::paths::is_windows_device_name;
use mokly_model::routes;

/// Check an imported CSS or asset route before it becomes public.
pub fn portable(path: &str, asset: bool) -> bool {
    if let Some(rest) = path.strip_prefix("node_modules/.mokly-roots/") {
        let Some((index, suffix)) = rest.split_once('/') else {
            return false;
        };
        return !index.starts_with('0')
            && index.bytes().all(|byte| byte.is_ascii_digit())
            && portable_segments(&format!("node_modules/{suffix}"), asset);
    }
    portable_segments(path, asset)
}

fn portable_segments(path: &str, asset: bool) -> bool {
    let mut previous = "";
    path.split('/').all(|part| {
        let name = if previous == "node_modules" {
            part.strip_prefix('@').unwrap_or(part)
        } else {
            part
        };
        previous = part;
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

/// Supported opaque asset content type, with case-sensitive extensions.
pub fn content_type(path: &str) -> Option<&'static str> {
    Some(match path.rsplit('.').next()? {
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "ico" => "image/vnd.microsoft.icon",
        "jpeg" | "jpg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "eot" => "application/vnd.ms-fontobject",
        "otf" => "font/otf",
        "ttf" => "font/ttf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => return None,
    })
}
