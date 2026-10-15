//! Progress formatting uses captured durations and complete erase prefixes.

use std::time::Duration;

use mokly_cli::output::{Mode, Style};

use super::{duration, frame};

#[test]
fn durations_round_milliseconds_and_keep_minutes_and_seconds() {
    for (input, expected) in [
        (Duration::from_micros(1500), "2ms"),
        (Duration::from_millis(4900), "4.9s"),
        (Duration::from_secs(123), "2m 03s"),
    ] {
        assert_eq!(duration(input), expected);
    }
}
#[test]
fn every_frame_erases_the_previous_line_and_respects_width() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: true,
        columns: 24,
    };
    let text = frame(&style, "Writing static output with a very long label", 2);
    assert!(text.starts_with("\r\x1b[2K"));
    assert!(unicode_width::UnicodeWidthStr::width(&text[5..]) <= 24);
    insta::assert_snapshot!(text);
}
