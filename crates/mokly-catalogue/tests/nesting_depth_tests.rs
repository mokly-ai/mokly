//! The deepest authored YAML that each parser survives on a 2 MiB worker stack.
//!
//! A child-process search finds each limit for the current build profile and
//! prints it. The YAML parser's block nesting and Mokly's builder reach the
//! search cap. Deep props stop where serde-derived traversal overflows, far
//! deeper than the deepest front matter that validation accepts.

use mokly_catalogue::error::CatalogueError;
use mokly_model::limits;
use tempfile::TempDir;
use yaml_rust2::parser::{Event, Parser};

#[path = "../../mokly-css/tests/depth_search/mod.rs"]
mod depth_search;
mod support;

use depth_search::{Failure, Probe, search};

const CHILD: &str = "depth_probe_child";
/// The search stops at this depth when nothing overflows.
const CAP: usize = 100_000;
/// The props depth that validation accepts, counted from the props map.
const PROPS: usize = limits::MAX_DEPTH;
/// Validation accepts no deeper front matter: variant props sit three levels
/// below the root and allow `PROPS` more.
const VALID: usize = 3 + PROPS;

/// Count the sequences that the YAML parser opens before the stream ends.
fn sequences(source: &str) -> usize {
    let mut parser = Parser::new_from_str(source);
    let mut count = 0;
    loop {
        match parser.next_token().unwrap().0 {
            Event::StreamEnd => return count,
            Event::SequenceStart(..) => count += 1,
            _ => {}
        }
    }
}

fn yaml_block(depth: usize) {
    assert_eq!(sequences(&format!("{}leaf\n", "- ".repeat(depth))), depth);
}

fn yaml_flow(depth: usize) {
    let source = format!("{}leaf{}\n", "[".repeat(depth), "]".repeat(depth));
    assert_eq!(sequences(&source), depth);
}

/// Prepare one screen whose front matter nests `depth` sequences under `field`.
fn prepare(field: &str, depth: usize, expected: &str) {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    let source = format!(
        "---\ntitle: Deep\n{field}:\n  deep:\n    {}leaf\n---\n<p>Deep</p>\n",
        "- ".repeat(depth)
    );
    support::write(directory.path(), "specs/deep.screen.html", &source);
    match support::prepare(directory.path(), None) {
        Ok(prepared) => assert_eq!(prepared.model.entries.len(), 1),
        Err(CatalogueError::Invalid { issues, .. }) => assert!(
            issues.iter().any(|issue| issue.message.contains(expected)),
            "{issues:?}"
        ),
        Err(other) => panic!("{other}"),
    }
}

fn front_matter_extra(depth: usize) {
    prepare("extra", depth, "unknown field extra");
}

fn front_matter_props(depth: usize) {
    prepare("props", depth, "exceeds 64 nesting levels");
}

/// Prepare a screen whose variant props reach `depth` levels below their props
/// map: `deep` nests `depth - 1` sequences around an empty array, so it is an
/// array at every depth. The schema accepts any array, so the props bound
/// decides the result. The body cannot read an array prop, so the only
/// warning is the unused prop.
fn front_matter_valid(depth: usize) {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    let source = format!(
        "---\ntitle: Deep\npropSchema:\n  type: object\n  additionalProperties: false\n  properties:\n    deep:\n      type: array\nvariants:\n  - slug: deeper\n    title: Deeper\n    props:\n      deep:\n        {}[]\n---\n<p>Deep</p>\n",
        "- ".repeat(depth - 1)
    );
    support::write(directory.path(), "specs/deep.screen.html", &source);
    let prepared = support::prepare(directory.path(), None).unwrap();
    assert_eq!(prepared.model.entries.len(), 2);
    assert!(
        prepared
            .warnings
            .iter()
            .all(|warning| warning.code == "html-unused-props"),
        "{:?}",
        prepared.warnings
    );
}

const PROBES: &[Probe] = &[
    ("yaml_block", yaml_block),
    ("yaml_flow", yaml_flow),
    ("front_matter_extra", front_matter_extra),
    ("front_matter_props", front_matter_props),
    ("front_matter_valid", front_matter_valid),
];

#[test]
#[ignore = "a child process of the depth searches below runs this probe"]
fn depth_probe_child() {
    depth_search::run_child(PROBES);
}

#[test]
fn yaml_parser_block_nesting_reaches_the_search_cap() {
    assert_eq!(search(CHILD, "yaml_block", CAP).depth, CAP);
}

#[test]
fn yaml_parser_rejects_flow_nesting_past_255_levels() {
    let limit = search(CHILD, "yaml_flow", CAP);
    assert_eq!(limit.depth, 255);
    let Some(Failure::Rejected(stderr)) = limit.failure else {
        panic!("{limit:?}");
    };
    assert!(stderr.contains("recursion limit exceeded"), "{stderr}");
}

#[test]
fn rejected_front_matter_fields_reach_the_search_cap() {
    assert_eq!(search(CHILD, "front_matter_extra", CAP).depth, CAP);
}

#[test]
fn deep_props_survive_every_valid_front_matter_depth() {
    let limit = search(CHILD, "front_matter_props", CAP);
    assert!(limit.depth >= VALID, "{limit:?}");
}

#[test]
fn the_deepest_valid_front_matter_prepares_cleanly() {
    assert_eq!(search(CHILD, "front_matter_valid", PROPS).depth, PROPS);
}
