//! One bounded Git command in the validated checkout, without optional locks.

use std::ffi::OsString;

use crate::command::{DEFAULT_STDERR_LIMIT, Request};
use crate::error::Result;
use crate::repository::GitRepository;

impl GitRepository {
    pub(crate) fn command(&self, args: &[&str], stdin: Vec<u8>, limit: usize) -> Result<Vec<u8>> {
        let mut arguments = vec![
            OsString::from("--no-optional-locks"),
            OsString::from("--literal-pathspecs"),
        ];
        arguments.extend(args.iter().map(OsString::from));
        Ok(self
            .runner
            .run(&Request {
                directory: self.directory.clone(),
                args: arguments,
                stdin,
                output_limit: limit,
                stderr_limit: DEFAULT_STDERR_LIMIT,
            })?
            .stdout)
    }
}
