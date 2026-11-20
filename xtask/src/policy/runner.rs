//! Dispatch policies through one injected repository environment.

use std::sync::Arc;

use crate::error::Result;

use super::boundary::BoundaryCheck;
use super::command::PolicyCommand;
use super::environment::Environment;
use super::migration_check::MigrationCheck;
use super::openapi::{OpenapiCheck, OpenapiValidator};
use super::openapi_client::{OpenapiGenerator, RustOpenapiGenerator};
use super::toolchain::ToolchainCheck;
use super::whitespace;

/// File and generated-output checks consumed by the application.
#[cfg_attr(test, unimock::unimock(api = [PolicyRunMock]))]
pub(crate) trait PolicyChecks: Send + Sync {
    /// Execute one named policy, without skipping missing inputs or tools.
    fn run(&self, command: PolicyCommand) -> Result<()>;
}

/// Default policy dispatcher; concrete dependencies live in the CLI root.
pub(crate) struct DefaultPolicyChecks {
    /// Repository IO boundary.
    pub(crate) environment: Arc<dyn Environment>,
}

impl PolicyChecks for DefaultPolicyChecks {
    fn run(&self, command: PolicyCommand) -> Result<()> {
        match command {
            PolicyCommand::Boundary => BoundaryCheck {
                environment: self.environment.clone(),
            }
            .check(),
            PolicyCommand::Whitespace => whitespace::check(self.environment.as_ref()),
            PolicyCommand::MigrationImmutability => MigrationCheck {
                environment: self.environment.clone(),
            }
            .check(),
            PolicyCommand::ToolchainPins => ToolchainCheck {
                environment: self.environment.clone(),
            }
            .check(),
            PolicyCommand::Openapi { check } => {
                let generator: &dyn OpenapiGenerator = &RustOpenapiGenerator {
                    environment: self.environment.clone(),
                };
                generator.generate(check)
            }
            PolicyCommand::OpenapiLint => {
                let validator: &dyn OpenapiValidator = &OpenapiCheck {
                    environment: self.environment.clone(),
                };
                validator.check()
            }
        }
    }
}
