//! Conservative charges include CSS bytes, assets, source snapshots, and dependency metadata.

use mokly_css::dependencies::DirectoryDependency;
use mokly_css::types::Bundle;

pub(crate) fn bundle(value: &Bundle) -> usize {
    let mut bytes = size_of::<Bundle>()
        + value.route.capacity()
        + value.css.capacity()
        + value.read_evidence.retained_bytes();
    for (path, source) in &value.inputs {
        bytes += size_of::<(String, Vec<u8>)>() + path.capacity() + source.capacity();
    }
    for (route, asset) in &value.assets {
        bytes += size_of_val(asset)
            + route.capacity()
            + asset.path.capacity()
            + asset.source.capacity()
            + asset.digest.capacity()
            + asset.aliases.capacity() * size_of::<String>()
            + asset.aliases.iter().map(String::capacity).sum::<usize>();
    }
    for (path, value) in value.imported_by.iter().chain(&value.dependency_digests) {
        bytes += size_of::<(String, String)>() + path.capacity() + value.capacity();
    }
    for path in &value.repository_aliases {
        bytes += size_of::<String>() + path.capacity();
    }
    for (path, names) in &value.css_modules {
        bytes += path.capacity() + size_of_val(names);
        for (name, value) in names {
            bytes += size_of::<(String, String)>() + name.capacity() + value.capacity();
        }
    }
    for (path, origin) in &value.plugin_inputs {
        bytes += size_of_val(origin)
            + size_of::<String>()
            + path.capacity()
            + origin.plugin.capacity()
            + origin.stylesheet.capacity();
    }
    bytes += value.directories.capacity() * size_of::<DirectoryDependency>();
    for directory in &value.directories {
        bytes += directory.path.capacity()
            + directory.glob.capacity()
            + directory.origin.plugin.capacity()
            + directory.origin.stylesheet.capacity();
    }
    bytes.saturating_mul(2)
}
