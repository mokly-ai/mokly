//! A `css.bundle` record names why the stylesheet cache could not serve its stylesheet.

use serde_json::Value;

use super::serve_trace_tests::capture;

fn bundles(records: &[Value]) -> Vec<&Value> {
    records
        .iter()
        .filter(|record| record["stage"] == "css.bundle")
        .collect()
}

#[test]
fn each_miss_reason_reaches_the_css_bundle_end_record() {
    for reason in [
        "no-record",
        "evicted",
        "stamp-mismatch",
        "inconsistent-evidence",
    ] {
        let records = capture(|| {
            let _span = tracing::info_span!("css.bundle", cache = reason).entered();
        });
        let spans = bundles(&records);
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[1]["event"], "end");
        assert_eq!(spans[1]["cache"], reason);
        assert_eq!(spans[1]["status"], "ok");
    }
}

#[test]
fn a_cache_value_that_is_no_miss_reason_stays_out_of_the_records() {
    let records = capture(|| {
        let _span = tracing::info_span!("css.bundle", cache = "/repo/private/tokens.css").entered();
    });
    let spans = bundles(&records);
    assert_eq!(spans.len(), 2);
    assert!(spans.iter().all(|span| span.get("cache").is_none()));
    assert!(
        !records
            .iter()
            .any(|record| record.to_string().contains("/repo"))
    );
}
