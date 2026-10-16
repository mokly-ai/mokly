//! Pool-owned settings fail with a typed restart diagnostic before module evaluation.

use mokly_catalogue::config_types::{Config, ResolvedConfig};

use crate::build::BuildError;

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
    let settings = ServeSettings::new(&original);
    settings.validate(&original).unwrap();
    let mut changed = original.clone();
    changed.repo_root = "/other".into();
    let error = settings.validate(&changed).unwrap_err();
    assert!(matches!(
        error,
        BuildError::RestartRequired {
            setting: "repoRoot"
        }
    ));
    assert_eq!(
        error.to_string(),
        "[mokly-cli/serve] repoRoot changed. Restart Serve to apply this setting."
    );
    let mut config = original;
    config.input.renderer = Some("renderer.tsx".into());
    settings.validate(&config).unwrap();
}
