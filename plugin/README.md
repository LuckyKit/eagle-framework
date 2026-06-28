# Eagle Runtime Plugins

`plugin/` is the runtime distribution root. Each direct child is one client
runtime adapter source, such as `claude/` or `codex/`.

Current layout:

- `claude/`: active Claude Code runtime source used by the CLI installer.
- `codex/`: reserved Codex runtime source. Add converted Codex skills, custom
  agents, and plugin metadata here when Codex distribution is implemented.

