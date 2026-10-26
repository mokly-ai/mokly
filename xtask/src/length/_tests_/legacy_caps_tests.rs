//! The legacy `oversizedCaps` table parses into exact caps, and every other
//! initializer or entry fails with the file label.

use crate::length::error::Error;

use super::super::caps::ProtocolCaps;
use super::parse_legacy_caps;

const LABEL: &str = "0123abc:tests/protocol_doc_sizes.test.ts";

/// The head of the former test at `1ca3cd28^`, the last commit that held it.
const HISTORICAL: &str = r#"import { repositoryRoot } from "./helpers/fixture.js";

const protocolDirectory = path.join(repositoryRoot, "docs/protocol");
const oversizedCaps: Readonly<Record<string, number>> = {
  "mokly-catalogue.md": 251,
  "mokly-design-components.md": 253,
  "mokly-design-links.md": 328,
  "mokly-export-delivery.md": 262,
  "mokly-frame-adapter.md": 380,
  "mokly-navigation.md": 372,
  "mokly-runtime.md": 434,
  "mokly-shell-design.md": 351,
  "mokly-viewer-appearance.md": 381,
  "mokly-viewer.md": 452,
};

function sizeIssue(name: string, lines: number, cap: number | undefined) {
  if (cap === undefined) return lines > 250 ? `${name} has ${lines} lines` : undefined;
}
"#;

fn caps(entries: &[(&str, u64)]) -> ProtocolCaps {
    let mut caps = ProtocolCaps::default();
    for (name, cap) in entries {
        caps.insert((*name).to_owned(), *cap);
    }
    caps
}

fn parse(source: &str) -> Result<Option<ProtocolCaps>, Error> {
    parse_legacy_caps(source.as_bytes(), LABEL)
}

#[test]
fn the_historical_table_parses_into_its_exact_caps() {
    assert_eq!(
        parse(HISTORICAL).unwrap(),
        Some(caps(&[
            ("mokly-catalogue.md", 251),
            ("mokly-design-components.md", 253),
            ("mokly-design-links.md", 328),
            ("mokly-export-delivery.md", 262),
            ("mokly-frame-adapter.md", 380),
            ("mokly-navigation.md", 372),
            ("mokly-runtime.md", 434),
            ("mokly-shell-design.md", 351),
            ("mokly-viewer-appearance.md", 381),
            ("mokly-viewer.md", 452),
        ]))
    );
}

#[test]
fn literal_tables_parse_through_parentheses_assertions_and_comments() {
    let expected = Some(caps(&[("long.md", 260)]));
    for source in [
        "const oversizedCaps = { \"long.md\": 260 };\n",
        "export let oversizedCaps = { 'long.md': 260, } as const;\n",
        "var oversizedCaps = ({ \"long.md\": 0x104 }) satisfies Record<string, number>\n",
        "const oversizedCaps = /* reviewed */ {\n  // the long page\n  \"long\\u002emd\": 2.6e2,\n};\n",
        "const oversizedCaps = ({ \"long.md\": 260 } as const);\n",
        "const oversizedCaps = { \"long.md\": 260 }\nexport default oversizedCaps;\n",
        "const oversizedCaps = { \"long.md\": 260 } as const\nexport default oversizedCaps;\n",
    ] {
        assert_eq!(parse(source).unwrap(), expected, "{source}");
    }
    assert_eq!(parse("const caps = { \"long.md\": 260 };\n").unwrap(), None);
}

#[test]
fn non_literal_tables_and_entries_fail_with_the_file_label() {
    for (source, expected) in [
        (
            "const oversizedCaps = caps;\n",
            "has an invalid oversizedCaps table",
        ),
        (
            "const oversizedCaps = { \"a.md\": 260 } || {};\n",
            "has an invalid oversizedCaps table",
        ),
        (
            "const oversizedCaps = { long: 260 };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { [name]: 260 };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { ...caps };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { \"a.md\": -260 };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { \"a.md\": 260n };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { \"a.md\": cap };\n",
            "has a non-literal oversizedCaps entry",
        ),
        (
            "const oversizedCaps = { \"a.md\": 250 };\n",
            "has an invalid cap for a.md",
        ),
        (
            "const oversizedCaps = { \"a.md\": 260.5 };\n",
            "has an invalid cap for a.md",
        ),
        (
            "const oversizedCaps = { \"a.md\": 260, \"a.md\": 261 };\n",
            "repeats the cap for a.md",
        ),
    ] {
        let message = parse(source).unwrap_err().to_string();
        assert!(
            message.contains(&format!("{LABEL} {expected}")),
            "{source}: {message}"
        );
    }
}
