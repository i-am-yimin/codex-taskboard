#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LaunchIntent { Open, ConnectDaily, Quit }

impl LaunchIntent {
    pub fn from_args<I, S>(args: I) -> Self
    where I: IntoIterator<Item = S>, S: AsRef<str> {
        let mut intent = Self::Open;
        for arg in args {
            match arg.as_ref() {
                "--quit-taskboard" => return Self::Quit,
                "--connect-daily-codex" => intent = Self::ConnectDaily,
                _ => {}
            }
        }
        intent
    }
}

#[cfg(test)]
mod tests {
    use super::LaunchIntent;
    #[test]
    fn ordinary_or_unknown_arguments_only_open_the_board() {
        assert_eq!(LaunchIntent::from_args(["taskboard.exe"]), LaunchIntent::Open);
        assert_eq!(LaunchIntent::from_args(["--quit-taskboard-extra"]), LaunchIntent::Open);
    }
    #[test]
    fn connection_entry_is_explicit() {
        assert_eq!(LaunchIntent::from_args(["taskboard.exe", "--connect-daily-codex"]), LaunchIntent::ConnectDaily);
    }
    #[test]
    fn quit_is_always_prioritized_over_starting_or_restoring_codex() {
        for args in [["--quit-taskboard", "--connect-daily-codex"], ["--connect-daily-codex", "--quit-taskboard"]] {
            assert_eq!(LaunchIntent::from_args(args), LaunchIntent::Quit);
        }
    }
}
