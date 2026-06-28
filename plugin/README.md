# Eagle Runtime Plugins

`plugin/` is the runtime distribution root. Each direct child is one client
runtime adapter source, such as `claude/` or `codex/`.

Current layout:

- `claude/`: Claude Code runtime source used by the CLI installer.
- `codex/`: Codex runtime source used by the CLI installer. Add converted Codex
  skills, custom agents, and plugin metadata here.
