//! Differential coverage for repository HTML and known parser divergences.

use std::fs;
use std::path::{Path, PathBuf};

use crate::{serialize, tree};

const GENERATED: &[&str] = &[
    "<math><annotation-xml encoding=\"text/html\"><div>x</div></annotation-xml></math>",
    "<form><mi><form><input></form></mi></form>",
    "<svg><style><b>x</b></style><title><b>x</b></title></svg>",
    "<noscript><p>x</p></noscript>",
    "<table>\r\noutside<tr><td>&amp; &#65;</td></tr></table>",
    "<plaintext><b>literal</b>",
];

const SCRIPT_DATA_CASES: &[&str] = &[
    "<script><!--<script>x</script>--></script>",
    "<script><!--\nsplit\n--></script>",
    "<script><!--split-->after</script>",
    "<script><!----></script>",
    "<script><!--x-\ny--></script>",
    "<script><!--x--\ny></script>",
    "<script><!--x</script-y--></script>",
    "<script><!--x</script y--></script>",
    "<script><!--<script>x</script>tail-->after</script>",
    "<script><!--x</script?tail--></script>",
];

const REGRESSION_CASES: &[(&str, &str)] = &[
    (
        "f19-fostered-wrapper",
        "<table>\n<tr><td><mokly-ignore-scope enabled='invalid' extra='first'>First</mokly-ignore-scope></td></tr>\n<mokly-ignore-scope enabled='invalid' extra='second'>Second</mokly-ignore-scope>\n</table>",
    ),
    (
        "f19-select-wrapper",
        "<select><mokly-ignore-scope enabled='invalid' extra='first'>First</mokly-ignore-scope></select>\n<mokly-ignore-scope enabled='invalid' extra='second'>Second</mokly-ignore-scope>",
    ),
    (
        "f21-markup-contexts",
        "<noscript><mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope></noscript><svg><style><mokly-ignore-scope typo='x'>B</mokly-ignore-scope></style></svg>",
    ),
    (
        "f21-foreign-raw",
        "<noframes><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></noframes><svg><script><mokly-ignore-scope typo='x'>B</mokly-ignore-scope></script></svg>",
    ),
    (
        "f22-page-wrapper",
        "<!doctype html><html><head></head><body><mokly-ignore id='x' class='kept'>Ignored</mokly-ignore></body></html>",
    ),
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
    let old = crate::support::legacy_authored_document(source);
    let new = crate::support::authored(source, name, true);
    if serialize::html(&old) != serialize::html(&new) {
        report.new_defects.push(name.into());
    } else {
        report.equivalent += 1;
    }
    report.source_identities += source_count(&new);
}

fn escaped_srcdoc(source: &str) -> String {
    source
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn compare_srcdoc(report: &mut Report, name: &str, source: &str) {
    let wrapper = format!("<iframe srcdoc=\"{}\"></iframe>", escaped_srcdoc(source));
    compare(report, &format!("{name}-wrapper"), &wrapper);

    let wrapper_tree = crate::support::legacy_authored_document(&wrapper);
    let content = tree::walk(&wrapper_tree).find_map(|node| match node {
        crate::tree::Node::Element(element) if element.name == "iframe" => {
            element.get("srcdoc").map(str::to_owned)
        }
        _ => None,
    });
    assert_eq!(
        content.as_deref(),
        Some(source),
        "srcdoc must decode exactly"
    );
    compare(report, &format!("{name}-content"), source);
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
    for (index, source) in SCRIPT_DATA_CASES.iter().enumerate() {
        compare(&mut report, &format!("script-data-{index}"), source);
        compare_srcdoc(&mut report, &format!("script-data-srcdoc-{index}"), source);
    }
    for (name, source) in REGRESSION_CASES {
        compare(&mut report, name, source);
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
