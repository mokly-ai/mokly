//! Unix keyboard input polls and reads inherited stdin without reopening its path.

use std::io;
use std::sync::Mutex;

use crate::serve_controls::{INPUT_INTERVAL, Input, KeyboardInput};
use crate::serve_keyboard_keys::KeyDecoder;

/// Keyboard input keeps the access granted to the inherited stdin descriptor.
#[derive(Default)]
pub(super) struct UnixKeyboard {
    keys: Mutex<KeyDecoder>,
}

impl KeyboardInput for UnixKeyboard {
    fn read(&self) -> io::Result<Input> {
        let mut descriptor = libc::pollfd {
            fd: libc::STDIN_FILENO,
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: poll borrows one initialized descriptor for the bounded call.
        let ready = unsafe { libc::poll(&mut descriptor, 1, INPUT_INTERVAL.as_millis() as i32) };
        if ready < 0 {
            let error = io::Error::last_os_error();
            return if error.kind() == io::ErrorKind::Interrupted {
                Ok(Input::Pending)
            } else {
                Err(error)
            };
        }
        if descriptor.revents & (libc::POLLHUP | libc::POLLERR | libc::POLLNVAL) != 0 {
            return Ok(Input::Closed);
        }
        if descriptor.revents & libc::POLLIN == 0 {
            return Ok(Input::Pending);
        }
        let mut byte = [0];
        // SAFETY: read borrows inherited stdin and writes at most one live buffer byte.
        let read = unsafe { libc::read(libc::STDIN_FILENO, byte.as_mut_ptr().cast(), byte.len()) };
        if read < 0 {
            let error = io::Error::last_os_error();
            return if matches!(
                error.kind(),
                io::ErrorKind::Interrupted | io::ErrorKind::WouldBlock
            ) {
                Ok(Input::Pending)
            } else {
                Err(error)
            };
        }
        if read == 0 {
            return Ok(Input::Closed);
        }
        let mut keys = self.keys.lock().unwrap_or_else(|error| error.into_inner());
        Ok(keys.push(byte[0]).map_or(Input::Pending, Input::Key))
    }
}
