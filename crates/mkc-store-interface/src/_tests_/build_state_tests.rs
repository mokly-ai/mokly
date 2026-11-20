//! Consumer causes round-trip through the SQL and API spellings.

use std::error::Error;

use crate::build_state::BuildFailure;

#[test]
fn consumer_causes_have_stable_storage_and_api_values() -> Result<(), Box<dyn Error>> {
    for (cause, value) in [
        (BuildFailure::UncommittedChanges, "uncommitted-changes"),
        (BuildFailure::Exit, "exit"),
    ] {
        assert_eq!(cause.as_str(), value);
        assert_eq!(value.parse::<BuildFailure>()?, cause);
        assert_eq!(serde_json::to_string(&cause)?, format!("\"{value}\""));
        assert_eq!(
            serde_json::from_str::<BuildFailure>(&format!("\"{value}\""))?,
            cause
        );
    }
    Ok(())
}
