//! The pool consumes the CLI's parsed policy without parsing it again.

use crate::pool_options::PoolOptions;

#[test]
fn parsed_options_preserve_the_callers_values() {
    let options = PoolOptions {
        size: 5.try_into().unwrap(),
        timeout_ms: Some(71),
    };
    assert_eq!(options.size.get(), 5);
    assert_eq!(options.timeout_ms, Some(71));
}
