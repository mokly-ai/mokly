//! Differential coverage for repository HTML and known parser divergences.

use std::fs;
use std::path::{Path, PathBuf};

use crate::{pipeline, serialize, tree};

const GENERATED: &[&str] = &[
    "<math><annotation-xml encoding=\"text/html\"><div>x</div></annotation-xml></math>",
    "<form><mi><form><input></form></mi></form>",
    "<svg><style><b>x</b></style><title><b>x</b></title></svg>",
    "<noscript><p>x</p></noscript>",
    "<table>\r\noutside<tr><td>&amp; &#65;</td></tr></table>",
    "<plaintext><b>literal</b>",
];

#[derive(Default)]
struct Report {
    inputs: usize,
    equivalent: usize,
    source_identities: usize,
    new_defects: Vec<String>,
}

fn html_files(root: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if matches!(name, ".git" | "node_modules" | "target" | ".context") {
            continue;
        }
        if path.is_dir() {
            html_files(&path, files);
        } else if path
            .extension()
            .is_some_and(|extension| extension == "html")
        {
            files.push(path);
        }
    }
}

fn source_count(nodes: &[crate::tree::Node]) -> usize {
    tree::walk(nodes)
        .filter(
            |node| matches!(node, crate::tree::Node::Element(element) if element.source.is_some()),
        )
        .count()
}

fn compare(report: &mut Report, name: &str, source: &str) {
    report.inputs += 1;
    let old = crate::parse::document(source);
    let new = pipeline::document(source, name);
    if serialize::html(&old) != serialize::html(&new) {
        report.new_defects.push(name.into());
    } else {
        report.equivalent += 1;
    }
    report.source_identities += source_count(&new);
}

#[test]
fn repository_html_differential_report_has_no_new_tree_or_byte_defects() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut files = Vec::new();
    html_files(&workspace, &mut files);
    let mut report = Report::default();
    for path in files {
        let source = fs::read_to_string(&path).expect("HTML fixture must be readable");
        compare(&mut report, &path.display().to_string(), &source);
    }
    for (index, source) in GENERATED.iter().enumerate() {
        compare(&mut report, &format!("generated-{index}"), source);
    }
    assert!(
        report.new_defects.is_empty(),
        "new pipeline differences: {:?}",
        report.new_defects
    );
    println!(
        "pipeline differential: inputs={} equivalent={} source_identities={} new_defects={}",
        report.inputs,
        report.equivalent,
        report.source_identities,
        report.new_defects.len()
    );
}
