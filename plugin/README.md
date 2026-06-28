# Eagle Runtime Plugins

`plugin/` is the runtime distribution root. Each direct child is one client
runtime adapter source, such as `claude/` or `codex/`.

Current layout:

- `claude/`: Claude Code runtime source used by the CLI installer.
- `codex/`: Codex runtime source used by the CLI installer. Add converted Codex
  skills, custom agents, and plugin metadata here.

## Runtime Sync

Claude is the current source of truth for Eagle workflow content. Codex skills
and custom agents are generated from `plugin/claude/`. The CLI runs this sync
automatically before installing Codex runtime, and maintainers can also run it
manually:

```bash
npm run sync:codex
```

Run this after editing `plugin/claude/skills/` or `plugin/claude/agents/` when
you want to inspect the generated files before install. Commit the generated
`plugin/codex/` files so installs work from a package without requiring a
source checkout workflow.
