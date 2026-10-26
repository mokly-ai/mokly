//! Read one CSS statement with cssparser's own rule parsers.

use cssparser::{
    AtRuleParser, BasicParseErrorKind, CowRcStr, DeclarationParser, ParseError, Parser,
    ParserInput, ParserState, QualifiedRuleParser, RuleBodyItemParser, RuleBodyParser,
    StyleSheetParser, Token,
};

use crate::token_sections::{Grammar, Statement};

/// The parser's start and statement kind for one source section.
pub(crate) struct Parsed {
    /// The byte offset relative to the section source.
    pub(crate) start: usize,
    /// The statement kind selected by cssparser.
    pub(crate) statement: Statement,
}

/// Read one section through the parser for its block grammar.
pub(crate) fn parse(source: &str, grammar: Grammar, first: bool, block: bool) -> Option<Parsed> {
    let mut source = if block {
        let mut block_source = String::with_capacity(source.len() + 2);
        block_source.push_str(source);
        block_source.push_str("{}");
        block_source
    } else {
        source.to_owned()
    };
    let (skip_first, prefix) = if matches!(grammar, Grammar::Stylesheet) && !first {
        let mut combined = String::with_capacity(source.len() + 3);
        combined.push_str("a{}");
        combined.push_str(&source);
        source = combined;
        (true, 3)
    } else {
        (false, 0)
    };
    parse_with_prefix(&source, grammar, skip_first).map(|mut parsed| {
        parsed.start = parsed.start.saturating_sub(prefix);
        parsed
    })
}

fn parse_with_prefix(source: &str, grammar: Grammar, skip_first: bool) -> Option<Parsed> {
    let mut input = ParserInput::new(source);
    let mut parser = Parser::new(&mut input);
    let mut probe = Probe::new(grammar);
    match grammar {
        Grammar::Stylesheet => {
            let parsed = {
                let mut rules = StyleSheetParser::new(&mut parser, &mut probe);
                if skip_first {
                    let _ = rules.next();
                }
                rules.next().and_then(|item| item.ok())
            };
            parsed.or_else(|| probe.fallback())
        }
        Grammar::Rules | Grammar::Lenient | Grammar::Style | Grammar::Declarations => {
            let parsed = {
                let mut rules = RuleBodyParser::new(&mut parser, &mut probe);
                rules.next().and_then(|item| item.ok())
            };
            parsed.or_else(|| probe.fallback())
        }
    }
}

/// A parser that records one statement and drains its body without recursion.
struct Probe {
    declarations: bool,
    pending: Option<Statement>,
    fallback: Option<Parsed>,
}

impl Probe {
    fn new(grammar: Grammar) -> Self {
        Self {
            declarations: matches!(grammar, Grammar::Style | Grammar::Declarations),
            pending: None,
            fallback: None,
        }
    }

    fn drain(input: &mut Parser<'_, '_>) {
        while input.next_including_whitespace_and_comments().is_ok() {}
    }

    fn record(&mut self, start: &ParserState, statement: Statement) -> Parsed {
        let parsed = Parsed {
            start: start.position().byte_index(),
            statement,
        };
        self.fallback = Some(Parsed {
            start: parsed.start,
            statement: parsed.statement.clone(),
        });
        parsed
    }

    fn fallback(self) -> Option<Parsed> {
        self.fallback
    }
}

impl<'i> AtRuleParser<'i> for Probe {
    type Prelude = ();
    type AtRule = Parsed;
    type Error = ();

    fn parse_prelude<'t>(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i, 't>,
    ) -> Result<Self::Prelude, ParseError<'i, Self::Error>> {
        self.pending = Some(Statement::AtRule(name.to_ascii_lowercase()));
        Self::drain(input);
        Ok(())
    }

    fn rule_without_block(
        &mut self,
        _prelude: Self::Prelude,
        start: &ParserState,
    ) -> Result<Self::AtRule, ()> {
        let statement = self.pending.take().ok_or(())?;
        Ok(self.record(start, statement))
    }

    fn parse_block<'t>(
        &mut self,
        _prelude: Self::Prelude,
        start: &ParserState,
        input: &mut Parser<'i, 't>,
    ) -> Result<Self::AtRule, ParseError<'i, Self::Error>> {
        Self::drain(input);
        let statement = self.pending.take().unwrap_or(Statement::Rule);
        Ok(self.record(start, statement))
    }
}

impl<'i> QualifiedRuleParser<'i> for Probe {
    type Prelude = ();
    type QualifiedRule = Parsed;
    type Error = ();

    fn parse_prelude<'t>(
        &mut self,
        input: &mut Parser<'i, 't>,
    ) -> Result<Self::Prelude, ParseError<'i, Self::Error>> {
        self.pending = Some(Statement::Rule);
        self.fallback = Some(Parsed {
            start: input.position().byte_index(),
            statement: Statement::Rule,
        });
        Self::drain(input);
        Ok(())
    }

    fn parse_block<'t>(
        &mut self,
        _prelude: Self::Prelude,
        start: &ParserState,
        input: &mut Parser<'i, 't>,
    ) -> Result<Self::QualifiedRule, ParseError<'i, Self::Error>> {
        Self::drain(input);
        Ok(self.record(start, Statement::Rule))
    }
}

impl<'i> DeclarationParser<'i> for Probe {
    type Declaration = Parsed;
    type Error = ();

    fn parse_value<'t>(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i, 't>,
        start: &ParserState,
    ) -> Result<Self::Declaration, ParseError<'i, Self::Error>> {
        let custom = name.starts_with("--");
        let mut has_curly = false;
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            has_curly |= matches!(token, Token::CurlyBracketBlock);
        }
        if has_curly && !custom {
            return Err(input.new_error(BasicParseErrorKind::UnexpectedToken(Token::Semicolon)));
        }
        Ok(self.record(start, Statement::Declaration(name.to_ascii_lowercase())))
    }
}

impl<'i> RuleBodyItemParser<'i, Parsed, ()> for Probe {
    fn parse_declarations(&self) -> bool {
        self.declarations
    }

    /// Every block reads qualified rules, as the lightningcss parsers of rule
    /// lists, keyframes, and style blocks do.
    fn parse_qualified(&self) -> bool {
        true
    }
}
