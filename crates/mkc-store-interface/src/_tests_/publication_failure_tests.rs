//! Changes-check outcome rows classify every persisted publication failure.

use crate::publication::PublicationFailure;

#[test]
fn changes_check_invalid_ingest_and_dependency_outage_rows_are_distinct() {
    for (failure, delivers, row) in [
        (
            PublicationFailure::InvalidBundle,
            true,
            "Invalid ingest with an authorized parsed envelope identity",
        ),
        (
            PublicationFailure::UnsupportedVersion,
            true,
            "Invalid ingest with an authorized parsed envelope identity",
        ),
        (
            PublicationFailure::TooLarge,
            true,
            "Invalid ingest with an authorized parsed envelope identity",
        ),
        (
            PublicationFailure::Internal,
            false,
            "Storage/network/database outage",
        ),
        (
            PublicationFailure::Superseded,
            false,
            "Authorization, deadline or superseded attempt",
        ),
        (
            PublicationFailure::Unauthorized,
            false,
            "Authorization, deadline or superseded attempt",
        ),
        (
            PublicationFailure::Expired,
            false,
            "Authorization, deadline or superseded attempt",
        ),
    ] {
        assert_eq!(
            failure.delivers_failure_check(),
            delivers,
            "{row}: {failure:?}"
        );
    }
}
