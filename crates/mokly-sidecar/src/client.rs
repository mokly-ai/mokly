//! Ordered client requests and exact-version hello handshake.

use crate::error::{Error, ProtocolError, Result};
use crate::methods::{Call, Empty};
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
    state: State,
}

#[derive(Clone, Copy, PartialEq)]
enum State {
    New,
    Ready,
    Closed,
}

impl Client {
    /// Compose a session from an injected framed transport and event sink.
    /// The executable supplies its embedded npm package version as the expected version.
    pub fn new(transport: Box<dyn Transport>, events: Box<dyn Events>, version: String) -> Self {
        Self {
            transport,
            events,
            version,
            state: State::New,
        }
    }
}

impl SidecarClient for Client {
    fn handshake(&mut self) -> Result<()> {
        if self.state == State::Ready {
            return Ok(());
        }
        if self.state == State::Closed {
            return Err(Error::Protocol(ProtocolError::SessionClosed));
        }
        self.state = State::Closed;
        let request = Request {
            id: 0,
            call: Call::Hello(Empty {}),
        };
        self.transport.send(&request)?;
        let Frame::Response(response) = self.transport.receive()? else {
            return Err(Error::Protocol(ProtocolError::Handshake));
        };
        let MethodResult::Hello(hello) = response.decode_result(&request)? else {
            return Err(Error::Protocol(ProtocolError::Handshake));
        };
        if hello.version != self.version {
            return Err(Error::Version {
                expected: self.version.clone(),
                actual: hello.version,
            });
        }
        self.state = State::Ready;
        tracing::debug!("sidecar hello completed");
        Ok(())
    }

    fn request(&mut self, request: &Request) -> Result<MethodResult> {
        if self.state == State::Closed {
            return Err(Error::Protocol(ProtocolError::SessionClosed));
        }
        if self.state != State::Ready || matches!(request.call, Call::Hello(_)) {
            return Err(Error::Protocol(ProtocolError::Handshake));
        }
        self.state = State::Closed;
        self.transport.send(request)?;
        tracing::trace!(request_id = request.id, "sidecar request sent");
        loop {
            match self.transport.receive()? {
                Frame::Event(event) => self.events.emit(event),
                Frame::Response(response) => {
                    let result = response.decode_result(request);
                    let reusable = match &result {
                        Ok(_) => true,
                        Err(Error::Remote { code, .. }) => code.reusable(),
                        Err(Error::Postcss { .. }) => true,
                        _ => false,
                    };
                    if reusable && !matches!(request.call, Call::Shutdown(_)) {
                        self.state = State::Ready;
                    }
                    return result;
                }
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
