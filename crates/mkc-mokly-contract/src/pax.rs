//! Bounded POSIX extended-header decoding; metadata never grants authority.

use std::collections::BTreeSet;
use std::io::{self, Read};

use crate::error::{Error, Limit, Rejection, Result, invalid};
use crate::limits::Limits;

#[derive(Default)]
pub(crate) struct Overrides {
    pub(crate) path: Option<String>,
    pub(crate) size: Option<u64>,
}

pub(crate) trait PaxReader {
    fn read(&self, source: &mut dyn Read, size: u64, limits: Limits) -> Result<Overrides>;
}

pub(crate) struct PosixPax;

impl PaxReader for PosixPax {
    fn read(&self, source: &mut dyn Read, size: u64, limits: Limits) -> Result<Overrides> {
        let mut input = source.take(size);
        let mut overrides = Overrides::default();
        let mut keys = BTreeSet::new();
        while input.limit() > 0 {
            let available = input.limit();
            let mut digits = String::new();
            let mut byte = [0];
            loop {
                if input.read_exact(&mut byte).is_err() {
                    return Err(invalid(Rejection::Pax));
                }
                if byte[0] == b' ' {
                    break;
                }
                if !byte[0].is_ascii_digit() || digits.len() == 20 {
                    return Err(invalid(Rejection::Pax));
                }
                digits.push(char::from(byte[0]));
            }
            let length = match digits.parse::<u64>() {
                Ok(length) if length <= available && length > digits.len() as u64 + 3 => length,
                _ => return Err(invalid(Rejection::Pax)),
            };
            let mut remaining = length - digits.len() as u64 - 1;
            let mut key = String::new();
            loop {
                if remaining < 2 || input.read_exact(&mut byte).is_err() {
                    return Err(invalid(Rejection::Pax));
                }
                remaining -= 1;
                if byte[0] == b'=' {
                    break;
                }
                if !byte[0].is_ascii() || key.len() == 16 {
                    return Err(invalid(Rejection::Pax));
                }
                key.push(char::from(byte[0]));
            }
            if !keys.insert(key.clone()) {
                return Err(invalid(Rejection::Pax));
            }
            let value_size = remaining - 1;
            match key.as_str() {
                "path" | "size" => {
                    let maximum = if key == "path" { limits.path() } else { 20 };
                    if value_size > maximum as u64 {
                        return Err(if key == "path" {
                            Error::TooLarge { limit: Limit::Path }
                        } else {
                            invalid(Rejection::Pax)
                        });
                    }
                    let mut value = vec![0; value_size as usize];
                    if input.read_exact(&mut value).is_err() {
                        return Err(invalid(Rejection::Pax));
                    }
                    let value = match String::from_utf8(value) {
                        Ok(value) => value,
                        Err(_) => return Err(invalid(Rejection::Pax)),
                    };
                    if key == "path" {
                        overrides.path = Some(value);
                    } else {
                        overrides.size = match value.parse() {
                            Ok(size)
                                if !value.is_empty()
                                    && value.bytes().all(|b| b.is_ascii_digit()) =>
                            {
                                Some(size)
                            }
                            _ => return Err(invalid(Rejection::Pax)),
                        };
                    }
                }
                "mtime" | "atime" | "ctime" | "uid" | "gid" | "uname" | "gname" | "comment"
                | "charset" => {
                    match io::copy(&mut input.by_ref().take(value_size), &mut io::sink()) {
                        Ok(read) if read == value_size => {}
                        _ => return Err(invalid(Rejection::Pax)),
                    }
                }
                _ => return Err(invalid(Rejection::Pax)),
            }
            if input.read_exact(&mut byte).is_err() || byte[0] != b'\n' {
                return Err(invalid(Rejection::Pax));
            }
        }
        Ok(overrides)
    }
}
