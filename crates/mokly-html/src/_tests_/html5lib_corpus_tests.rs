//! The html5lib tree-construction corpus parses to the reference tree through the shared driver.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::template_types::Template;

use crate::parse;
use crate::support::{legacy_delivered_document, legacy_delivered_fragment};
use crate::tree::{self, Node};

/// The number of `#data` inputs in the vendored corpus; a lost file fails the tests.
const CASES: usize = 1796;

fn dat_files(directory: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).expect("corpus directory must be readable") {
        let path = entry.expect("corpus entry").path();
        if path.is_dir() {
            dat_files(&path, files);
        } else if path.extension().is_some_and(|extension| extension == "dat") {
            files.push(path);
        }
    }
}

/// Each corpus input, named by its file and its index in that file.
fn cases() -> Vec<(String, String)> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/html5lib");
    let mut files = Vec::new();
    dat_files(&root, &mut files);
    files.sort();
    let mut cases = Vec::new();
    for file in files {
        let text = fs::read_to_string(&file).expect("corpus file must be UTF-8");
        let name = file.strip_prefix(&root).expect("corpus path").display();
        for (index, chunk) in text.split("#data\n").skip(1).enumerate() {
            let data: Vec<_> = chunk
                .lines()
                .take_while(|line| *line != "#errors")
                .collect();
            cases.push((format!("{name}#{index}"), data.join("\n")));
        }
    }
    assert_eq!(cases.len(), CASES);
    cases
}

#[test]
fn corpus_documents_match_the_reference_parser() {
    let differences: Vec<_> = cases()
        .into_iter()
        .filter(|(_, data)| {
            parse::html(DeliveredHtml::document(data)) != legacy_delivered_document(data)
        })
        .map(|(name, _)| name)
        .collect();
    assert!(differences.is_empty(), "{differences:#?}");
}

#[test]
fn corpus_body_fragments_match_the_reference_parser() {
    let differences: Vec<_> = cases()
        .into_iter()
        .filter(|(_, data)| {
            parse::html(DeliveredHtml::fragment(data)) != legacy_delivered_fragment(data)
        })
        .map(|(name, _)| name)
        .collect();
    assert!(differences.is_empty(), "{differences:#?}");
}

/// The byte offset of a one-based line and character column.
fn offset(source: &str, line: usize, column: usize) -> usize {
    let start = source
        .split_inclusive('\n')
        .take(line - 1)
        .map(str::len)
        .sum::<usize>();
    start
        + source[start..]
            .chars()
            .take(column - 1)
            .map(char::len_utf8)
            .sum::<usize>()
}

fn names_own_start_tag(source: &str, at: usize, name: &str) -> bool {
    let Some(tag) = source.get(at..).and_then(|rest| rest.strip_prefix('<')) else {
        return false;
    };
    let named = |expected: &str| {
        tag.get(..expected.len())
            .is_some_and(|actual| actual.eq_ignore_ascii_case(expected))
    };
    named(name) || (name == "img" && named("image"))
}

#[test]
fn corpus_positions_name_their_own_start_tags() {
    for (name, data) in cases() {
        let template = Template {
            source_path: "corpus.html".into(),
            source: data.clone(),
            body: data.clone(),
            body_offset: 0,
            page: true,
        };
        let nodes = parse::html(template.located_html());
        let mut seen = BTreeSet::new();
        for node in tree::walk(&nodes) {
            let Node::Element(element) = node else {
                continue;
            };
            let Some(source) = &element.source else {
                continue;
            };
            let at = offset(&data, source.line, source.column);
            assert!(
                names_own_start_tag(&data, at, &element.name),
                "{name}: {} at {}:{}",
                element.name,
                source.line,
                source.column
            );
            assert!(seen.insert(at), "{name}: two elements share {at}");
        }
    }
}
