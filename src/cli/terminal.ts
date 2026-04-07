export interface TerminalCapabilities {
  supportsAnsi: boolean;
  supportsUnicode: boolean;
  supportsTrueColor: boolean;
  isModernTerminal: boolean;
}

export function detectTerminal(): TerminalCapabilities {
  const env = process.env;

  // Windows Terminal
  const isWindowsTerminal = !!env.WT_SESSION;
  // macOS Terminal.app, iTerm2, etc.
  const termProgram = env.TERM_PROGRAM ?? "";
  // General terminal type
  const term = env.TERM ?? "";

  const isModernTerminal =
    isWindowsTerminal ||
    termProgram === "iTerm.app" ||
    termProgram === "Apple_Terminal" ||
    termProgram === "vscode" ||
    termProgram === "Hyper" ||
    termProgram === "WezTerm" ||
    term.includes("256color") ||
    term.includes("xterm") ||
    term === "screen";

  const supportsAnsi = isModernTerminal || process.stdout.isTTY === true;

  const supportsUnicode = isModernTerminal && !(!isWindowsTerminal && process.platform === "win32"); // old cmd.exe

  const supportsTrueColor =
    isWindowsTerminal ||
    env.COLORTERM === "truecolor" ||
    termProgram === "iTerm.app" ||
    termProgram === "vscode";

  return {
    supportsAnsi,
    supportsUnicode,
    supportsTrueColor,
    isModernTerminal,
  };
}
