//! The public step component includes null before a build starts.

use mkc_store_interface::build_state::BuildStep;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[schema(as = BuildStep)]
pub(crate) struct BuildStepView(#[schema(inline)] Option<Step>);

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
enum Step {
    Checkout,
    Install,
    Publish,
}

impl From<Option<BuildStep>> for BuildStepView {
    fn from(value: Option<BuildStep>) -> Self {
        Self(value.map(|step| match step {
            BuildStep::Checkout => Step::Checkout,
            BuildStep::Install => Step::Install,
            BuildStep::Publish => Step::Publish,
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/step_tests.rs"]
mod tests;
