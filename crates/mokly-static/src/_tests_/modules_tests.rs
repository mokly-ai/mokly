//! JavaScript grammar separates module requests from prose and computed expressions.

use mokly_model::output::artifact::File;

use crate::modules::validate;

fn files(script: &str) -> Vec<File> {
    vec![
        File {
            path: "mokly-viewer/client/shell.js".into(),
            bytes: script.as_bytes().to_vec().into(),
        },
        File {
            path: "mokly-viewer/client/a+b.js".into(),
            bytes: b"export const a = 1;".as_slice().into(),
        },
    ]
}

#[test]
fn validates_import_export_dynamic_and_decoded_specifiers() {
    for script in [
        "import './a+b.js';",
        "import(`./a+b.js`)",
        "export * from './a+b.js';",
        "export {a} from './a+b.js?x:y';",
        "import('./a\\x2bb.js');",
        "const s = `import './missing.js'`; const r = /import('x')/; import.meta.url; import(name);",
    ] {
        validate(&files(script)).unwrap();
    }
    for script in [
        "import './missing.js'",
        "export * from './missing.js'",
        "import('./missing.js')",
        "import(`./missing.js`)",
        "import 'https://foreign.invalid/a.js'",
        "const = syntax",
    ] {
        assert!(validate(&files(script)).is_err(), "{script}");
    }
}

#[test]
fn absolute_module_requests_resolve_from_the_site_root_and_syntax_names_position() {
    validate(&files("import '/mokly-viewer/client/a+b.js';")).unwrap();
    let error = validate(&files("\nconst = syntax")).unwrap_err();
    assert!(
        matches!(error, crate::error::Error::ModuleSyntax { path, line: 2, column: 7 } if path == "mokly-viewer/client/shell.js")
    );
}
