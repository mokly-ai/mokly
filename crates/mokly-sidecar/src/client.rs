//! Ordered client requests and exact-version hello handshake.

use crate::error::{Error, ProtocolError, Result};
use crate::methods::{Call, Hello};
use crate::wire::{Event, Frame, MethodResult, Request};

/// Framed transport provided by the process pool.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = TransportMock))]
pub trait Transport: Send {
    /// Send one request as a bounded JSON frame.
    fn send(&mut self, request: &Request) -> Result<()>;
    /// Read one bounded response or event, or report process exit.
    fn receive(&mut self) -> Result<Frame>;
}

/// Event delivery through the core reporter.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = EventsMock))]
pub trait Events: Send {
    /// Forward one diagnostic event.
    fn emit(&mut self, event: Event);
}

/// Client boundary used by the later sidecar pool.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClientMock))]
pub trait SidecarClient: Send {
    /// Complete the first hello exchange and require the exact package version.
    fn handshake(&mut self) -> Result<()>;
    /// Send one ordered request after a successful hello.
    fn request(&mut self, request: &Request) -> Result<MethodResult>;
}

/// A single sidecar protocol session; no process or pool lifecycle is owned here.
pub struct Client {
    transport: Box<dyn Transport>,
    events: Box<dyn Events>,
    version: String,
    timings: bool,
}

impl Client {
    /// Compose a session from an injected framed transport and event sink.
    /// The executable supplies its embedded npm package version as the expected version.
    pub fn new(transport: Box<dyn Transport>, events: Box<dyn Events>, version: String) -> Self {
        Self {
            transport,
            events,
            version,
            timings: false,
        }
    }

    /// Select opt-in timing delivery through the first hello request.
    pub fn with_timings(mut self, enabled: bool) -> Self {
        self.timings = enabled;
        self
    }
}

impl SidecarClient for Client {
    fn handshake(&mut self) -> Result<()> {
        let request = Request {
            id: 0,
            call: Call::Hello(Hello {
                timings: self.timings,
            }),
        };
        self.transport.send(&request)?;
        let Frame::Response(response) = self.transport.receive()? else {
            return Err(Error::Protocol(ProtocolError::Handshake));
        };
        let hello = response.decode_result(&request)?.into_hello();
        if hello.version != self.version {
            return Err(Error::Version {
                expected: self.version.clone(),
                actual: hello.version,
            });
        }
        tracing::debug!("sidecar hello completed");
        Ok(())
    }

    fn request(&mut self, request: &Request) -> Result<MethodResult> {
        self.transport.send(request)?;
        tracing::trace!(request_id = request.id, "sidecar request sent");
        loop {
            match self.transport.receive()? {
                Frame::Event(event) => self.events.emit(event),
                Frame::Response(response) => return response.decode_result(request),
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/client_tests.rs"]
mod client_tests;

#[cfg(test)]
#[path = "_tests_/session_tests.rs"]
mod session_tests;
