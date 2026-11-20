//! Lifetime phrasing used by both hosted template models.

use crate::mail::Lifetime;

#[test]
fn lifetime_phrase_uses_the_issuing_services_units() {
    assert_eq!(Lifetime::Minutes(1).phrase(), "1 minute");
    assert_eq!(Lifetime::Minutes(15).phrase(), "15 minutes");
    assert_eq!(Lifetime::Days(1).phrase(), "1 day");
    assert_eq!(Lifetime::Days(7).phrase(), "7 days");
}
