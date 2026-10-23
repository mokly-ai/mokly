//! Raw text guards for HTML `noscript` in scripting-enabled browsers.

/// Write raw text. Inside an HTML noscript, raw text cannot end the element in a
/// scripting-enabled browser, so escape every case-insensitive `</noscript`.
/// Include the last nine bytes so adjacent raw writes cannot split the tag.
pub(crate) fn write_raw(inside: bool, value: &str, output: &mut String) {
    let mut start = output.len().saturating_sub("</noscript".len() - 1);
    while !output.is_char_boundary(start) {
        start += 1;
    }
    output.push_str(value);
    if !inside {
        return;
    }
    let mut escaped = String::new();
    let mut from = start;
    for (offset, _) in output[start..].match_indices('<') {
        let at = start + offset;
        if output[at..]
            .get(.."</noscript".len())
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("</noscript"))
        {
            escaped.push_str(&output[from..at]);
            escaped.push_str("&lt;");
            from = at + 1;
        }
    }
    if from != start {
        escaped.push_str(&output[from..]);
        output.truncate(start);
        output.push_str(&escaped);
    }
}
