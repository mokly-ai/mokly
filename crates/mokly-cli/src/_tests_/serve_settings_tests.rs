//! Pool-owned settings fail with a typed restart diagnostic before module evaluation.

use mokly_catalogue::config_types::{Config, ResolvedConfig};

use crate::build::BuildError;
use crate::grammar::Common;

use super::ServeSettings;

#[test]
fn pool_setting_changes_request_restart_and_ordinary_config_changes_pass() {
    let original = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let options = Common::default();
    let settings = ServeSettings::new(&original, &options);
    settings.validate(&original, &options).unwrap();
    for name in ["repoRoot", "sidecars", "sidecarTimeoutMs"] {
        let mut config = original.clone();
        let mut changed = options.clone();
        match name {
            "repoRoot" => config.repo_root = "/other".into(),
            "sidecars" => changed.sidecars = Some(2),
            _ => changed.sidecar_timeout_ms = Some(71),
        }
        let error = settings.validate(&config, &changed).unwrap_err();
        assert!(matches!(error, BuildError::RestartRequired { setting } if setting == name));
        assert_eq!(
            error.to_string(),
            format!("[mokly-cli/serve] {name} changed. Restart Serve to apply this setting.")
        );
    }
    let mut config = original;
    config.input.renderer = Some("renderer.tsx".into());
    settings.validate(&config, &options).unwrap();
}
