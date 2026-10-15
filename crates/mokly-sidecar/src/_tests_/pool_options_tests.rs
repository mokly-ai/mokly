//! Sizing and timeout policy has no ambient dependencies.

use crate::pool_options::{Environment, PoolOptions};

#[test]
fn cli_precedes_environment_and_defaults_to_cores() {
    assert_eq!(
        PoolOptions::resolve(None, &Environment::default(), 12)
            .unwrap()
            .size,
        12
    );
    let environment = Environment {
        sidecars: Some("3".into()),
        timeout_ms: Some("71".into()),
    };
    let options = PoolOptions::resolve(Some("5"), &environment, 12).unwrap();
    assert_eq!(options.size, 5);
    assert_eq!(options.timeout_ms, Some(71));
    assert_eq!(
        PoolOptions::resolve(None, &environment, 12).unwrap().size,
        3
    );
    for value in ["", "0", "-1", "+1", "1.2", " 2", "2 "] {
        assert!(PoolOptions::resolve(Some(value), &Environment::default(), 4).is_err());
    }
}
