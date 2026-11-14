//! Stream one converted Git blob into a caller-owned writer.

use std::io::Write;

use crate::checkout::admit;
use crate::checkout_batch::{Active, FILTER_TIMEOUT, conversion_args, request, timed_out};
use crate::checkout_output::conversion;
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

impl GitRepository {
    pub(crate) fn checkout_stream(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<usize> {
        let limit = limit.min(DEFAULT_OUTPUT_LIMIT);
        if timed_out(self, commit, std::slice::from_ref(entry)).is_some() {
            return conversion(Err(Error::CheckoutTimeout), std::slice::from_ref(entry));
        }
        admit(
            std::slice::from_ref(entry),
            Limits {
                blob: limit,
                bytes: limit,
                ..Limits::default()
            },
        )?;
        let request = request(self, commit, conversion_args(entry, true), Vec::new());
        let mut counted = CountingWriter { output, length: 0 };
        let result = self.runner.stream_cancellable_with_environment_timeout(
            &request,
            &Active,
            &[("LC_ALL", "C".into())],
            FILTER_TIMEOUT,
            &mut counted,
            limit,
        );
        if matches!(result, Err(Error::CheckoutTimeout)) {
            self.timed_out
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert((commit.clone(), entry.object.clone(), entry.path.clone()));
        }
        conversion(result, std::slice::from_ref(entry))?;
        Ok(counted.length)
    }
}

struct CountingWriter<'a> {
    output: &'a mut (dyn Write + Send),
    length: usize,
}

impl Write for CountingWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.output.write_all(bytes)?;
        self.length = self.length.saturating_add(bytes.len());
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.output.flush()
    }
}
