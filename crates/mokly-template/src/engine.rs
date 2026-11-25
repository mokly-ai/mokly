//! The environment for a catalogue's compiled HTML bodies.

use std::collections::BTreeMap;
use std::sync::Arc;

use minijinja::machinery::parse;
use minijinja::{Environment, ErrorKind};
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;

use crate::analysis::{Analysis, collect};
use crate::context::context;
use crate::error::TemplateError;
use crate::lexer::scan;
use crate::lowering::lower;
use crate::rendered::{OutputSpan, RenderedBody};
use crate::settings::environment;
use crate::source_map::SourceMap;

struct Body {
    analysis: Analysis,
    map: SourceMap,
    private_name: Option<Arc<str>>,
    schema: PropSchema,
}

/// Compile bodies by source identity and render them with their props.
pub struct Engine {
    environment: Environment<'static>,
    bodies: BTreeMap<String, Body>,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    /// Create an empty template environment.
    pub fn new() -> Self {
        Self {
            environment: environment(),
            bodies: BTreeMap::new(),
        }
    }

    /// Compile a body and return its discovery evidence.
    pub fn compile(
        &mut self,
        name: &str,
        source: &str,
        schema: &PropSchema,
    ) -> Result<&Analysis, TemplateError> {
        let syntax = self.environment.syntax();
        let lexed = scan(source, name, syntax.clone())?;
        if !lexed.forbidden.is_empty() {
            return Err(TemplateError::Forbidden {
                name: name.to_owned(),
                constructs: lexed.forbidden,
            });
        }
        let lowered = lower(source, &lexed, schema)?;
        let analysis = {
            let ast = match parse(&lowered.text, name, syntax.clone()) {
                Ok(ast) => ast,
                Err(error) => return Err(TemplateError::syntax(error, &lowered.map)),
            };
            collect(
                &ast,
                lexed.blanked,
                schema,
                &lowered.map,
                lowered.private_name.as_deref(),
            )
        };
        if let Err(error) = self
            .environment
            .add_template_owned(name.to_owned(), lowered.text)
        {
            return Err(TemplateError::syntax(error, &lowered.map));
        }
        let body = self
            .bodies
            .entry(name.to_owned())
            .insert_entry(Body {
                analysis,
                map: lowered.map,
                private_name: lowered.private_name,
                schema: schema.clone(),
            })
            .into_mut();
        Ok(&body.analysis)
    }

    /// Get the discovery evidence for a compiled body.
    pub fn analysis(&self, name: &str) -> Option<&Analysis> {
        self.bodies.get(name).map(|body| &body.analysis)
    }

    /// Determine whether MiniJinja supplies this name as a global.
    pub fn has_global(&self, name: &str) -> bool {
        self.environment.globals().any(|(global, _)| global == name)
    }

    /// Render a compiled body with its validated prop values.
    pub fn render(&self, name: &str, props: &Props) -> Result<RenderedBody, TemplateError> {
        let body = self.bodies.get(name).ok_or_else(|| TemplateError::Render {
            offset: None,
            source: minijinja::Error::new(ErrorKind::TemplateNotFound, name.to_owned()),
        })?;
        let template = match self.environment.get_template(name) {
            Ok(template) => template,
            Err(error) => return Err(TemplateError::render(error, &body.map)),
        };
        let context = context(props, &body.schema, body.private_name.as_ref());
        let (text, spans) = match template.render_with_spans(context) {
            Ok(rendered) => rendered,
            Err(error) => return Err(TemplateError::render(error, &body.map)),
        };
        let spans = spans
            .iter()
            .map(|span| OutputSpan::from_minijinja(span, &body.map))
            .collect();
        Ok(RenderedBody { text, spans })
    }
}
