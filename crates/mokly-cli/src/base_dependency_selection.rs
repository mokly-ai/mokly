//! Dependency tier timing and configured module resolution preserve their original values.

use mokly_catalogue::config_types::{ModuleLoader, ResolvedConfig};
use mokly_compare::dependency_types::Tier;
use mokly_render::side::source_package_maps;
use mokly_sidecar::methods::ModuleResolution;

pub(super) fn tier_number(tier: Tier) -> u64 {
    match tier {
        Tier::Working => 1,
        Tier::Installed => 2,
        Tier::Fallback => 3,
    }
}

pub(super) fn resolution(config: &ResolvedConfig) -> ModuleResolution {
    let authored = config.input.module_resolution.clone().unwrap_or_default();
    let loaders = authored
        .loaders
        .unwrap_or_default()
        .into_iter()
        .map(|(extension, loader)| {
            let name = match loader {
                ModuleLoader::Base64 => "base64",
                ModuleLoader::Binary => "binary",
                ModuleLoader::Dataurl => "dataurl",
                ModuleLoader::Empty => "empty",
                ModuleLoader::File => "file",
                ModuleLoader::Js => "js",
                ModuleLoader::Json => "json",
                ModuleLoader::Jsx => "jsx",
                ModuleLoader::Text => "text",
                ModuleLoader::Ts => "ts",
                ModuleLoader::Tsx => "tsx",
            };
            (extension, name.into())
        })
        .collect();
    ModuleResolution {
        dependency_root: None,
        aliases: authored.aliases.unwrap_or_default(),
        conditions: authored.conditions.unwrap_or_default(),
        loaders,
        main_fields: authored.main_fields.unwrap_or_default(),
        resolve_extensions: authored.resolve_extensions.unwrap_or_default(),
        package_roots: config.package_roots(),
        source_packages: source_package_maps(config),
    }
}
