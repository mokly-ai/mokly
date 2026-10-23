//! Pure lightningcss bundling over a fully prepared source map.

use std::path::Path;

use lightningcss::bundler::{Bundler, ResolveResult, SourceProvider};
use lightningcss::stylesheet::{ParserOptions, PrinterOptions};

use crate::compiler::Preparation;
use crate::error::{CssError, Result, TransformFailure};
use crate::paths;

impl SourceProvider for Preparation<'_> {
    type Error = CssError;

    fn read<'a>(&'a self, file: &Path) -> Result<&'a str> {
        self.sources
            .get(file.to_string_lossy().as_ref())
            .map(String::as_str)
            .ok_or_else(|| CssError::Import {
                stylesheet: file.to_string_lossy().into(),
                specifier: file.to_string_lossy().into(),
            })
    }

    fn resolve(&self, specifier: &str, originating_file: &Path) -> Result<ResolveResult> {
        if paths::external(specifier) {
            return Ok(ResolveResult::External(specifier.into()));
        }
        let importer = originating_file.to_string_lossy();
        self.resolutions
            .get(&(importer.to_string(), specifier.into()))
            .map(|path| ResolveResult::File(path.into()))
            .ok_or_else(|| CssError::Import {
                stylesheet: importer.into(),
                specifier: specifier.into(),
            })
    }
}

pub(crate) fn bundle(root: &str, provider: &Preparation<'_>) -> Result<String> {
    let mut bundler = Bundler::new(provider, None, ParserOptions::default());
    let stylesheet = match bundler.bundle(Path::new(root)) {
        Ok(stylesheet) => stylesheet,
        Err(error) => {
            return Err(CssError::Transform {
                kind: TransformFailure::Syntax,
                message: format!(
                    "could not bundle CSS {}: {}; fix the stylesheet and rebuild",
                    provider.result.route.trim_start_matches("styles/"),
                    error.kind
                ),
            });
        }
    };
    match stylesheet.to_css(PrinterOptions::default()) {
        Ok(result) => Ok(result.code.trim_end_matches('\n').to_owned() + "\n"),
        Err(error) => Err(CssError::Transform {
            kind: TransformFailure::Syntax,
            message: format!(
                "could not bundle CSS {}: {}; fix the stylesheet and rebuild",
                provider.result.route.trim_start_matches("styles/"),
                error.kind
            ),
        }),
    }
}
