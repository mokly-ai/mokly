//! Split one filtered conversion batch into its files and classify conversion failures.

use std::io::{self, Write};

use crate::error::{Error, IoResult, Result};
use crate::tree::Entry;

/// The longest header record, `{object} blob {size}`, that a batch may print.
pub(crate) const HEADER_BYTES: usize = 256;

/// Destinations of the converted files of one batch, opened in batch order.
pub(crate) trait BatchFiles: Send {
    /// Open the destination of the entry at `index` of the batch.
    fn open(&mut self, index: usize) -> Result<Box<dyn Write + Send>>;
}

/// Decodes `git cat-file --batch --filters -Z` output while Git writes it. Git
/// prints the raw blob size in each header, not the converted size, so the
/// `{sentinel} missing` record that follows each file ends it. Content bytes
/// count against one bound for the whole batch.
pub(crate) struct BatchSink<'a> {
    entries: &'a [Entry],
    files: &'a mut dyn BatchFiles,
    delimiter: Vec<u8>,
    pending: Vec<u8>,
    output: Option<Box<dyn Write + Send>>,
    next: usize,
    written: usize,
    limit: usize,
    failure: Option<Error>,
}

impl<'a> BatchSink<'a> {
    pub(crate) fn new(
        entries: &'a [Entry],
        files: &'a mut dyn BatchFiles,
        sentinel: &str,
        limit: usize,
    ) -> Self {
        Self {
            entries,
            files,
            delimiter: format!("\0{sentinel} missing\0").into_bytes(),
            pending: Vec::new(),
            output: None,
            next: 0,
            written: 0,
            limit,
            failure: None,
        }
    }

    /// The typed failure that stopped the stream, which wins over the copy error.
    pub(crate) fn failure(&mut self) -> Option<Error> {
        self.failure.take()
    }

    /// Requires every file of the batch and nothing else; returns the content bytes.
    pub(crate) fn finish(mut self) -> Result<usize> {
        if let Some(error) = self.failure.take() {
            return Err(error);
        }
        if self.output.is_some() || !self.pending.is_empty() || self.next != self.entries.len() {
            return Err(Error::MalformedOutput);
        }
        Ok(self.written)
    }

    fn consume(&mut self, bytes: &[u8]) -> Result<()> {
        self.pending.extend_from_slice(bytes);
        loop {
            if self.output.is_none() {
                if self.pending.is_empty() {
                    return Ok(());
                }
                let Some(entry) = self.entries.get(self.next) else {
                    return Err(Error::MalformedOutput);
                };
                let Some(end) = self.pending.iter().position(|byte| *byte == 0) else {
                    if self.pending.len() > HEADER_BYTES {
                        return Err(Error::MalformedOutput);
                    }
                    return Ok(());
                };
                header(&self.pending[..end], entry)?;
                self.pending.drain(..=end);
                self.output = Some(self.files.open(self.next)?);
            } else if let Some(end) = find(&self.pending, &self.delimiter) {
                self.emit(end)?;
                self.pending.drain(..end + self.delimiter.len());
                if let Some(mut output) = self.output.take() {
                    output.flush().git()?;
                }
                self.next += 1;
            } else {
                let keep = self.delimiter.len() - 1;
                if self.pending.len() > keep {
                    let end = self.pending.len() - keep;
                    self.emit(end)?;
                    self.pending.drain(..end);
                }
                return Ok(());
            }
        }
    }

    fn emit(&mut self, end: usize) -> Result<()> {
        self.written = self.written.saturating_add(end);
        if self.written > self.limit {
            return Err(Error::ByteLimit { limit: self.limit });
        }
        let Some(output) = self.output.as_mut() else {
            return Err(Error::MalformedOutput);
        };
        output.write_all(&self.pending[..end]).git()
    }
}

impl Write for BatchSink<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.failure.is_none()
            && let Err(error) = self.consume(bytes)
        {
            self.failure = Some(error);
        }
        if self.failure.is_some() {
            return Err(io::Error::other("the conversion batch stopped"));
        }
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Accepts `{object} blob {size}` for the expected blob; the size is the raw size.
fn header(line: &[u8], entry: &Entry) -> Result<()> {
    let Ok(line) = str::from_utf8(line) else {
        return Err(Error::MalformedOutput);
    };
    let fields = line.split_ascii_whitespace().collect::<Vec<_>>();
    let [object, "blob", size] = fields.as_slice() else {
        return Err(Error::MalformedOutput);
    };
    if *object != entry.object.as_str() || size.parse::<usize>().is_err() {
        return Err(Error::MalformedOutput);
    }
    Ok(())
}

/// The first position of `needle`, which starts with NUL, in `haystack`.
fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .iter()
        .enumerate()
        .filter(|(_, byte)| **byte == 0)
        .map(|(index, _)| index)
        .find(|index| haystack[*index..].starts_with(needle))
}

pub(crate) fn conversion<T>(result: Result<T>, entries: &[Entry]) -> Result<T> {
    match result {
        Err(
            source @ (Error::CheckoutTimeout
            | Error::CheckoutFailed { .. }
            | Error::CommandFailed { .. }
            | Error::ByteLimit { .. }
            | Error::OutputLimit { .. }),
        ) => Err(Error::Conversion {
            path: entries
                .first()
                .map_or(".", |entry| entry.path.as_str())
                .into(),
            source: Box::new(source),
        }),
        other => other,
    }
}

#[cfg(test)]
#[path = "_tests_/checkout_output_tests.rs"]
mod checkout_output_tests;
