//! The deepest authored YAML that each parser survives on a 2 MiB worker stack.
//!
//! A child-process search finds each limit for the current build profile and
//! prints it. The YAML parser's block nesting reaches the search cap. Mokly's
//! builder rejects a value more than [`yaml_limits::MAX_DEPTH`] levels below
//! the root before any recursive traversal, so front matter of any depth
//! reaches the search cap. The deepest front matter that the builder accepts
//! survives the serde-derived traversal of fields, props, and schemas.

use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::yaml_limits;
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
/// The props and schema depth that validation accepts, counted from the
/// props map or the schema root.
const PROPS: usize = limits::MAX_DEPTH;
/// Validation accepts no deeper front matter: variant props sit three levels
/// below the root and allow `PROPS` more.
const VALID: usize = 3 + PROPS;
/// The builder's limit leaves room above every valid front matter.
const _: () = assert!(VALID < yaml_limits::MAX_DEPTH);
/// The deepest `{field}: deep:` nesting that the builder accepts: the field's
/// value sits one level below the root, and `deep` one more.
const FIELD: usize = yaml_limits::MAX_DEPTH - 2;
/// The deepest `deep` prop schema that the builder accepts: its innermost
/// `type` value sits four levels below the root, plus one per array schema.
const SCHEMA: usize = yaml_limits::MAX_DEPTH - 4;
/// The deepest variant prop that the builder accepts: it sits three levels
/// below the root, plus its own depth.
const VARIANT: usize = yaml_limits::MAX_DEPTH - 3;
const PROPS_TOO_DEEP: &str = "exceeds 64 nesting levels";
const YAML_TOO_DEEP: &str = "exceeds 128 nesting levels";

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

/// Prepare one screen with `front_matter` after its title. `None` expects
/// entries whose only warnings are unused props. A message expects an issue
/// that contains it.
fn prepare(front_matter: &str, expected: Option<&str>) {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    let source = format!("---\ntitle: Deep\n{front_matter}---\n<p>Deep</p>\n");
    support::write(directory.path(), "specs/deep.screen.html", &source);
    match (support::prepare(directory.path(), None), expected) {
        (Ok(prepared), None) => {
            assert!(!prepared.model.entries.is_empty());
            assert!(
                prepared
                    .warnings
                    .iter()
                    .all(|warning| warning.code == "html-unused-props"),
                "{:?}",
                prepared.warnings
            );
        }
        (Err(CatalogueError::Invalid { issues, .. }), Some(expected)) => assert!(
            issues.iter().any(|issue| issue.message.contains(expected)),
            "{issues:?}"
        ),
        (Ok(_), Some(expected)) => panic!("prepared without {expected}"),
        (Err(CatalogueError::Invalid { issues, .. }), None) => panic!("{issues:?}"),
        (Err(other), _) => panic!("{other}"),
    }
}

/// `depth` sequences under `{name}: deep:`. Past the builder's limit, every
/// field fails with the builder's depth message.
fn field(name: &str, depth: usize, expected: Option<&str>) {
    let front_matter = format!("{name}:\n  deep:\n    {}leaf\n", "- ".repeat(depth));
    let expected = if depth > FIELD {
        Some(YAML_TOO_DEEP)
    } else {
        expected
    };
    prepare(&front_matter, expected);
}

fn front_matter_extra(depth: usize) {
    field("extra", depth, Some("unknown field extra"));
}

/// Without a prop schema, Mokly infers one array schema per level. The
/// innermost inferred `type` sits `depth + 3` levels below the schema root,
/// so the schema bound fails before the props bound.
fn front_matter_props(depth: usize) {
    let expected = (depth + 3 > PROPS).then_some(PROPS_TOO_DEEP);
    field("props", depth, expected);
}

/// A `deep` prop schema that nests `depth` array schemas. Validation accepts
/// it while its innermost `type` value sits at most `PROPS` levels deep.
fn front_matter_schema(depth: usize) {
    let mut schema = String::new();
    for level in 0..depth {
        let indent = "  ".repeat(level + 3);
        schema.push_str(&format!("{indent}type: array\n{indent}items:\n"));
    }
    schema.push_str(&format!("{}type: string\n", "  ".repeat(depth + 3)));
    let root = "propSchema:\n  type: object\n  additionalProperties: false\n";
    let front_matter = format!("{root}  properties:\n    deep:\n{schema}");
    let expected = if depth + 3 <= PROPS {
        None
    } else if depth <= SCHEMA {
        Some(PROPS_TOO_DEEP)
    } else {
        Some(YAML_TOO_DEEP)
    };
    prepare(&front_matter, expected);
}

/// Variant props that reach `depth` levels below their props map: `deep`
/// nests `depth - 1` sequences around an empty array, so it is an array at
/// every depth. The schema accepts any array, so the props bound decides.
fn front_matter_variant(depth: usize) {
    let root = "propSchema:\n  type: object\n  additionalProperties: false\n";
    let schema = format!("{root}  properties:\n    deep:\n      type: array\n");
    let variant = "variants:\n  - slug: deeper\n    title: Deeper\n    props:\n      deep:\n";
    let front_matter = format!("{schema}{variant}        {}[]\n", "- ".repeat(depth - 1));
    let expected = if depth <= PROPS {
        None
    } else if depth <= VARIANT {
        Some(PROPS_TOO_DEEP)
    } else {
        Some(YAML_TOO_DEEP)
    };
    prepare(&front_matter, expected);
}

const PROBES: &[Probe] = &[
    ("yaml_block", yaml_block),
    ("yaml_flow", yaml_flow),
    ("front_matter_extra", front_matter_extra),
    ("front_matter_props", front_matter_props),
    ("front_matter_schema", front_matter_schema),
    ("front_matter_variant", front_matter_variant),
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
fn front_matter_of_any_depth_reaches_the_search_cap() {
    for probe in [
        "front_matter_extra",
        "front_matter_props",
        "front_matter_variant",
    ] {
        assert_eq!(search(CHILD, probe, CAP).depth, CAP, "{probe}");
    }
}

#[test]
fn the_deepest_front_matter_that_the_builder_accepts_survives_traversal() {
    for (probe, depth) in [
        ("front_matter_extra", FIELD),
        ("front_matter_props", FIELD),
        ("front_matter_schema", SCHEMA),
        ("front_matter_variant", VARIANT),
    ] {
        assert_eq!(search(CHILD, probe, depth).depth, depth, "{probe}");
    }
}

#[test]
fn the_deepest_valid_front_matter_prepares_cleanly() {
    assert_eq!(search(CHILD, "front_matter_variant", PROPS).depth, PROPS);
}

/// Each stated limit is the last depth of one outcome, and the next depth
/// gives the next outcome. The probes run in this process, far below any
/// stack limit.
#[test]
fn each_probe_changes_its_outcome_after_its_stated_limits() {
    for (name, last) in [
        ("front_matter_extra", FIELD),
        ("front_matter_props", PROPS - 3),
        ("front_matter_props", FIELD),
        ("front_matter_schema", PROPS - 3),
        ("front_matter_schema", SCHEMA),
        ("front_matter_variant", PROPS),
        ("front_matter_variant", VARIANT),
    ] {
        let probe = PROBES.iter().find(|probe| probe.0 == name).unwrap().1;
        probe(last);
        probe(last + 1);
    }
}
