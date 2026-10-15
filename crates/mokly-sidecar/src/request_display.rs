//! Request diagnostics identify sources and axes without printing data props or CSS.

use std::fmt::{self, Display, Formatter};

use crate::methods::{Call, Render};

impl Display for Call {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Hello(_) => formatter.write_str("hello"),
            Self::Bundle(_) => formatter.write_str("bundle"),
            Self::Describe(value) => write!(formatter, "describe {}", value.generation),
            Self::RenderScreen(value) => render(formatter, value),
            Self::RenderComponent(value) => render(formatter, &value.render),
            Self::RenderStory(value) => write!(
                formatter,
                "{} ({}, {:?})",
                value.story_id, value.viewport, value.color_scheme
            ),
            Self::RenderPage(value) => formatter.write_str(&value.handle),
            Self::ProcessCss(value) => {
                write!(formatter, "{} for {}", value.postcss, value.source_path)
            }
            Self::CssModules(value) => write!(formatter, "cssModules {}", value.generation),
            Self::Dispose(value) => write!(formatter, "dispose {}", value.generation),
            Self::Shutdown(_) => formatter.write_str("shutdown"),
        }
    }
}

fn render(formatter: &mut Formatter<'_>, value: &Render) -> fmt::Result {
    write!(
        formatter,
        "{} ({}, {:?})",
        value.handle, value.viewport, value.color_scheme
    )
}
