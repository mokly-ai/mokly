//! Decoded source maps preserve byte origins across the vendored HTML inputs.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_catalogue::html_input::{DeliveredHtml, HtmlInput};
use mokly_catalogue::html_tokens::{self, Spanned, Token};
use mokly_catalogue::template_types::Template;

fn files(root: &Path, paths: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            files(&path, paths);
        } else if path
            .extension()
            .is_some_and(|ext| ext == "dat" || ext == "html")
        {
            paths.push(path);
        }
    }
}

fn corpus() -> Vec<(String, String)> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut paths = Vec::new();
    files(&root.join("html5lib"), &mut paths);
    files(&root.join("differential"), &mut paths);
    paths.sort();
    let mut cases = Vec::new();
    for path in paths {
        let source = fs::read_to_string(&path).unwrap();
        if path.extension().is_some_and(|ext| ext == "dat") {
            for (index, chunk) in source.split("#data\n").skip(1).enumerate() {
                cases.push((
                    format!("{}#{index}", path.display()),
                    chunk
                        .lines()
                        .take_while(|line| *line != "#errors")
                        .collect::<Vec<_>>()
                        .join("\n"),
                ));
            }
        } else {
            cases.push((path.display().to_string(), source));
        }
    }
    cases
}

fn check_value(name: &str, source: &str, text: &Spanned, attribute: bool) {
    let range = text.source_map.span;
    assert!(
        range.start <= range.end && range.end <= source.len(),
        "{name}: {text:?}"
    );
    assert!(
        if attribute {
            text.span.start <= range.start && range.end <= text.span.end
        } else {
            range.start <= text.span.start && text.span.end <= range.end
        },
        "{name}: {text:?}"
    );
    let raw = &source.as_bytes()[range.start..range.end];
    let plain = !raw.iter().any(|byte| [b'&', b'\r', 0].contains(byte));
    let mut previous = range.start;
    for (decoded, byte) in text.value.iter().enumerate() {
        let offset = text.source_offset(decoded);
        assert!(previous <= offset, "{name}: {text:?}, byte {decoded}");
        assert!(
            range.start <= offset && offset < range.end,
            "{name}: {text:?}, byte {decoded}"
        );
        let aligned = text.source_map.is_aligned(decoded);
        let original = source.as_bytes()[offset];
        assert!(
            !aligned || original == *byte || (original == b'\r' && *byte == b'\n'),
            "{name}: {text:?}, byte {decoded}"
        );
        assert!(
            !plain || offset == range.start + decoded,
            "{name}: {text:?}"
        );
        previous = offset;
    }
}

fn check(name: &str, input: HtmlInput<'_>) {
    for parsed in html_tokens::parse(input) {
        match parsed.token {
            Token::String(text) => check_value(name, input.text(), &text, false),
            Token::StartTag(tag) => {
                for text in tag.attributes.values() {
                    check_value(name, input.text(), text, true);
                }
            }
            _ => {}
        }
    }
}

#[test]
fn corpus_source_maps_are_monotonic_bounded_and_preserve_aligned_bytes() {
    for (name, source) in corpus() {
        for page in [false, true] {
            let template = Template {
                source_path: name.clone(),
                source: source.clone(),
                body: source.clone(),
                body_offset: 0,
                page,
            };
            check(&name, template.html().into());
            let delivered = if page {
                DeliveredHtml::document(&source)
            } else {
                DeliveredHtml::fragment(&source)
            };
            check(&name, delivered.into());
        }
    }
}
