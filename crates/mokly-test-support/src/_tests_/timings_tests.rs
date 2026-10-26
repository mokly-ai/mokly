use crate::timings::timings;

#[test]
fn timing_records_are_read_after_their_common_fields_are_checked() {
    let stderr = concat!(
        "other line\n",
        r#"[mokly:timing] {"schemaVersion":1,"session":"s","pid":1,"role":"core","stage":"config.load","event":"start","id":1,"elapsedMs":0}"#,
        "\n",
        r#"[mokly:timing] {"schemaVersion":1,"session":"s","pid":1,"role":"core","stage":"config.load","event":"end","id":1,"parentId":0,"elapsedMs":2,"durationMs":2,"status":"ok"}"#,
        "\n",
    );
    let records = timings(stderr);
    assert_eq!(records.len(), 2);
    assert_eq!(records[1].stage(), "config.load");
    assert_eq!(records[1].event(), "end");
    assert_eq!(records[1].status(), Some("ok"));
    assert_eq!(records[1].parent_id(), Some(0));
}

#[test]
#[should_panic(expected = "no timing records")]
fn output_without_timing_records_fails() {
    timings("plain output\n");
}
