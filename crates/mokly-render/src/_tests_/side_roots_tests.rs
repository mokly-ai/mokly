use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::config_types::{Config, ModuleResolution as Authored, ResolvedConfig};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependencies::{Dependencies, DependencyTiers};
use mokly_compare::dependency_types::{Request, Tier};
use mokly_compare::inputs::Inputs;
use mokly_git::identity::RepoPath;
use mokly_sidecar::methods::ModuleResolution;
use unimock::Unimock;

use super::{BaseSide, inputs};

/// A configuration in `app/` whose package roots repeat its parent ancestor.
fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config {
            module_resolution: Some(Authored {
                package_roots: Some(vec!["..".into()]),
                ..Authored::default()
            }),
            ..Config::default()
        },
        file: PathBuf::from("/repo/app/mokly.config.json"),
        repo_root: PathBuf::from("/repo"),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    }
}

#[test]
fn a_working_tier_base_selects_the_same_package_roots_as_the_head() {
    let config = config();
    let head = inputs(&config, None, 0).unwrap();
    let request = Request {
        base: Inputs::default(),
        head: Inputs::default(),
        source_root: "/cache/base".into(),
        install_scripts: false,
        source_identity: "commit".into(),
        head_root: config.repo_root.clone(),
        configuration: RepoPath::parse("app/mokly.config.json").unwrap(),
        used_directories: Vec::new(),
        unmapped_directories: Vec::new(),
        resolution: ModuleResolution {
            package_roots: config.package_roots(),
            ..ModuleResolution::default()
        },
    };
    let tiers: &dyn Dependencies = &DependencyTiers {
        cache: Arc::new(Unimock::new(())),
        commands: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        timeout: Duration::from_secs(120),
        install_bytes: 10_000,
    };
    let dependencies = tiers.resolve(&request).unwrap();
    assert_eq!(dependencies.tier, Tier::Working);
    let side = Arc::new(BaseSide {
        sources: Lease {
            directory: "/cache/base".into(),
            guard: Box::new(Unimock::new(())),
        },
        dependencies,
        identity: "commit".into(),
    });
    let base = inputs(&config, Some(&side), 0).unwrap();
    assert_eq!(head.module_resolution, base.module_resolution);
    assert_eq!(head.dependency_roots, base.dependency_roots);
}
