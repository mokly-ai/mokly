//! Bundle requests name the renderer by its normalized repository path.

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_sidecar::methods::ModuleResolution;

use crate::bundle_inputs::params;
use crate::side::SideInputs;

fn side() -> SideInputs {
    SideInputs {
        source_root: "/repo".into(),
        repository_roots: vec!["/repo".into()],
        module_resolution: ModuleResolution::default(),
        configuration_directory: String::new(),
        context: "head".into(),
        dependency_aliases: Default::default(),
        dependency_roots: Vec::new(),
    }
}

#[test]
fn the_bundle_request_names_the_normalized_renderer_path() {
    for (file, renderer, expected) in [
        (
            "/repo/app/mokly.config.json",
            "../renderer.tsx",
            "renderer.tsx",
        ),
        (
            "/repo/mokly.config.json",
            "app/../renderer.tsx",
            "renderer.tsx",
        ),
        (
            "/repo/mokly.config.json",
            "lib/./renderer.tsx",
            "lib/renderer.tsx",
        ),
        (
            "/repo/mokly.config.json",
            "lib//renderer.tsx",
            "lib/renderer.tsx",
        ),
    ] {
        let config = ResolvedConfig {
            input: Config {
                renderer: Some(renderer.into()),
                ..Default::default()
            },
            file: file.into(),
            repo_root: "/repo".into(),
            authored_inputs: Vec::new(),
            roots: Vec::new(),
        };
        assert_eq!(
            params(&config, &[], &side()).renderer.as_deref(),
            Some(expected),
            "{renderer}"
        );
    }
}
