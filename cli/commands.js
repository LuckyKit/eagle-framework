#!/usr/bin/env node
'use strict'

const fs   = require('fs')
const path = require('path')
const os   = require('os')
const { execSync } = require('child_process')
const readline = require('readline')

const FRAMEWORK_DIR       = path.join(__dirname, '..')
const TARGET_DIR          = process.cwd()
const CLAUDE_SETTINGS     = path.join(os.homedir(), '.claude', 'settings.json')
const PLUGIN_KEY          = 'eagle@eagle-framework'

// ─── 颜色 ────────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m',  red: '\x1b[31m', dim: '\x1b[2m',
}

const log  = (msg) => console.log(msg)
const ok   = (msg) => console.log(`${c.green}✅ ${msg}${c.reset}`)
const warn = (msg) => console.log(`${c.yellow}⚠️  ${msg}${c.reset}`)
const info = (msg) => console.log(`${c.blue}ℹ️  ${msg}${c.reset}`)
const err  = (msg) => console.error(`${c.red}❌ ${msg}${c.reset}`)
const dim  = (msg) => console.log(`${c.dim}${msg}${c.reset}`)

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

// ─── 入口 ────────────────────────────────────────────────────────────────────

async function main() {
  const [,, command = 'help', ...flags] = process.argv

  const hasUser    = flags.includes('--user')    || flags.includes('-u')
  const hasProject = flags.includes('--project') || flags.includes('-p')
  const hasAll     = flags.includes('--all')     || flags.includes('-a')

  // --all 等价于同时指定 --user --project
  const opts = {
    user:    hasUser || hasAll,
    project: hasProject || hasAll,
    // 没有任何 flag → 交互式询问
    interactive: !hasUser && !hasProject && !hasAll,
  }

  switch (command) {
    case 'install':   await installCommand(opts);   break
    case 'uninstall': await uninstallCommand(opts); break
    case 'sense':     await senseProject();         break
    case 'map':       await mapProjectCommand();     break
    default:          printHelp();
  }

  rl.close()
}

// ─── INSTALL ─────────────────────────────────────────────────────────────────

async function installCommand(opts) {
  log(`\n${c.bold}🦅 Eagle Framework — 安装${c.reset}\n`)

  let { user, project } = opts

  if (opts.interactive) {
    log('选择安装级别（可多选，空格分隔）：')
    log('  [1] 用户级  — 注册 Claude Code 插件，全局所有项目可用')
    log('  [2] 项目级  — 复制规范/组件蓝图到当前项目 .eagle/')
    log('  [3] 全部    — 同时安装两层')
    log('')
    const input = await ask('输入编号 (例: 1 2 或 3): ')
    const nums  = input.split(/\s+/).map(Number)
    user    = nums.includes(1) || nums.includes(3)
    project = nums.includes(2) || nums.includes(3)

    if (!user && !project) {
      err('未选择安装级别，已取消')
      return
    }
    log('')
  }

  if (user)    await installUser()
  if (project) await installProject()
}

// ── 用户级安装：写入 ~/.claude/settings.json ─────────────────────────────────

async function installUser() {
  log(`${c.bold}[用户级] 注册 Claude Code 插件${c.reset}`)

  const gitUrl = resolveGitUrl()
  if (!gitUrl) {
    err('无法确定框架 git 地址，跳过用户级安装。')
    err('请在 package.json 的 repository.url 填写正确地址后重试。')
    return
  }

  info(`插件地址：${gitUrl}`)

  const settings = readClaudeSettings()

  // pluginMarketplaces
  if (!Array.isArray(settings.pluginMarketplaces)) {
    settings.pluginMarketplaces = []
  }
  if (settings.pluginMarketplaces.includes(gitUrl)) {
    info('pluginMarketplaces 中已包含该地址，跳过')
  } else {
    settings.pluginMarketplaces.push(gitUrl)
  }

  // enabledPlugins
  if (!settings.enabledPlugins || typeof settings.enabledPlugins !== 'object') {
    settings.enabledPlugins = {}
  }
  if (settings.enabledPlugins[PLUGIN_KEY] === true) {
    info(`enabledPlugins["${PLUGIN_KEY}"] 已启用，跳过`)
  } else {
    settings.enabledPlugins[PLUGIN_KEY] = true
  }

  writeClaudeSettings(settings)
  ok(`用户级安装完成 → ${CLAUDE_SETTINGS}`)
  dim('  重启 Claude Code 后生效，/discuss /dev /fix /refactor /new-project 全局可用')
  log('')
}

// ── 项目级安装：接入当前项目，不改变业务项目结构 ─────────────────────────────

async function installProject() {
  log(`${c.bold}[项目级] 接入当前项目${c.reset}`)

  const projectName = path.basename(TARGET_DIR)
  const detectedStacks = detectStacks()
  const stacks = detectedStacks.map(s => s.key)

  info(`项目：${projectName}`)
  if (detectedStacks.length) {
    info(`检测到技术栈：${detectedStacks.map(s => s.label).join(' + ')}`)
  } else {
    info('未检测到明确技术栈，先按通用项目初始化；后续可运行 eagle map 刷新')
  }

  log('\n📁 创建 Eagle 上下文目录...')
  createEagleDirs()

  log('📋 复制编码规范...')
  copyAvailableRules()

  log('🧩 复制组件蓝图...')
  copyComponents()

  log('🧭 初始化生命周期文件...')
  createLifecycleFiles(projectName, stacks)

  log('🗺️ 生成代码库地图...')
  mapCodebase(stacks)

  log('')
  ok(`项目级接入完成："${projectName}"`)
  dim('  后续直接使用 /eagle:dev <需求> 开始新功能迭代')
  log('')
}

// ─── UNINSTALL ───────────────────────────────────────────────────────────────

async function uninstallCommand(opts) {
  log(`\n${c.bold}🦅 Eagle Framework — 卸载${c.reset}\n`)

  let { user, project } = opts

  if (opts.interactive) {
    log('选择卸载级别（可多选，空格分隔）：')
    log('  [1] 用户级  — 从 ~/.claude/settings.json 移除插件注册')
    log('  [2] 项目级  — 删除当前项目 .eagle/ 中的框架文件')
    log('  [3] 全部    — 同时卸载两层')
    log('')
    const input = await ask('输入编号 (例: 1 2 或 3): ')
    const nums  = input.split(/\s+/).map(Number)
    user    = nums.includes(1) || nums.includes(3)
    project = nums.includes(2) || nums.includes(3)

    if (!user && !project) {
      err('未选择卸载级别，已取消')
      return
    }
    log('')
  }

  if (user)    await uninstallUser()
  if (project) await uninstallProject()
}

// ── 用户级卸载：从 ~/.claude/settings.json 移除 ──────────────────────────────

async function uninstallUser() {
  log(`${c.bold}[用户级] 移除 Claude Code 插件注册${c.reset}`)

  const settings = readClaudeSettings()
  const gitUrl   = resolveGitUrl()
  let changed    = false

  // pluginMarketplaces
  if (Array.isArray(settings.pluginMarketplaces) && gitUrl) {
    const before = settings.pluginMarketplaces.length
    settings.pluginMarketplaces = settings.pluginMarketplaces.filter(u => u !== gitUrl)
    if (settings.pluginMarketplaces.length < before) {
      info('已从 pluginMarketplaces 移除')
      changed = true
    } else {
      info('pluginMarketplaces 中未找到该地址，跳过')
    }
    if (settings.pluginMarketplaces.length === 0) {
      delete settings.pluginMarketplaces
    }
  }

  // enabledPlugins
  if (settings.enabledPlugins && settings.enabledPlugins[PLUGIN_KEY] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_KEY]
    info(`已从 enabledPlugins 移除 "${PLUGIN_KEY}"`)
    changed = true
    if (Object.keys(settings.enabledPlugins).length === 0) {
      delete settings.enabledPlugins
    }
  } else {
    info(`enabledPlugins 中未找到 "${PLUGIN_KEY}"，跳过`)
  }

  if (changed) {
    writeClaudeSettings(settings)
    ok('用户级卸载完成')
    dim('  重启 Claude Code 后生效')
  } else {
    warn('未发现需要清理的条目')
  }
  log('')
}

// ── 项目级卸载：清理 .eagle/ ────────────────────────────────────────────────────

async function uninstallProject() {
  log(`${c.bold}[项目级] 清理当前项目 .eagle/${c.reset}`)

  const eagleDir = path.join(TARGET_DIR, '.eagle')
  if (!fs.existsSync(eagleDir)) {
    warn('未找到 .eagle/ 目录，无需卸载')
    return
  }

  const knowledgeCount = countFiles(path.join(eagleDir, 'knowledge'))
  const memoryCount    = countFiles(path.join(eagleDir, 'memory'))
  const taskCount      = countDirs(path.join(eagleDir, 'tasks'))

  log('将删除（框架静态文件）：')
  log('  .eagle/rules/        — 编码规范快照')
  log('  .eagle/components/   — 组件蓝图快照')
  log('  .eagle/QUICKSTART.md')
  log('')
  log('默认保留（你积累的项目数据）：')
  log(`  .eagle/knowledge/    — ${knowledgeCount} 个文件`)
  log(`  .eagle/memory/       — ${memoryCount} 个文件`)
  log(`  .eagle/tasks/        — ${taskCount} 个历史任务`)
  log('')

  const confirm = await ask('确认删除框架静态文件？(y/N) ')
  if (confirm.toLowerCase() !== 'y') { log('已取消'); return }

  removeDirSafe(path.join(eagleDir, 'rules'))
  removeDirSafe(path.join(eagleDir, 'components'))
  removeFileSafe(path.join(eagleDir, 'QUICKSTART.md'))
  ok('框架静态文件已删除')

  if (knowledgeCount + memoryCount + taskCount > 0) {
    log('')
    const removeData = await ask('是否同时删除 knowledge / memory / tasks？(y/N) ')
    if (removeData.toLowerCase() === 'y') {
      removeDirSafe(path.join(eagleDir, 'knowledge'))
      removeDirSafe(path.join(eagleDir, 'memory'))
      removeDirSafe(path.join(eagleDir, 'tasks'))
      ok('用户数据已删除')
    } else {
      info('knowledge / memory / tasks 已保留')
    }
  }

  if (isDirEmpty(eagleDir)) {
    fs.rmdirSync(eagleDir)
    info('.eagle/ 目录已清空并移除')
  }

  cleanGitignore()
  log('')
  ok('项目级卸载完成')
  log('')
}

// ─── SENSE ───────────────────────────────────────────────────────────────────

async function senseProject() {
  log(`\n${c.bold}🦅 Eagle Framework — 项目感知${c.reset}\n`)

  const stacks = detectStacks()
  const eagleDir = path.join(TARGET_DIR, '.eagle')

  log(`检测到技术栈：${stacks.length ? stacks.map(s => s.label).join(' + ') : '未检测到（非 Monorepo 结构）'}`)
  log('')

  if (!fs.existsSync(eagleDir)) {
    const ans = await ask('未找到 .eagle/，是否初始化 Eagle 规范？(y/N) ')
    if (ans.toLowerCase() === 'y') {
      createEagleDirs()
      copyRules(stacks.map(s => s.key))
      copyComponents()
      createLifecycleFiles(path.basename(TARGET_DIR), stacks.map(s => s.key))
      mapCodebase(stacks.map(s => s.key))
      ok('.eagle/ 已初始化')
    }
    return
  }

  for (const { key } of stacks) {
    const exists = fs.existsSync(path.join(eagleDir, 'rules', key, 'INDEX.md'))
    log(`  ${exists ? c.green+'✅' : c.red+'❌'} .eagle/rules/${key}/${c.reset}`)
  }

  const taskCount = countDirs(path.join(eagleDir, 'tasks'))
  log('')
  log(`  知识库：.eagle/knowledge/  |  记忆库：.eagle/memory/  |  任务：${taskCount} 个`)
  log('')
  ok('感知完成。可用命令：/new-project /discuss /dev /fix /refactor')
}

async function mapProjectCommand() {
  log(`\n${c.bold}🦅 Eagle Framework — 代码库地图${c.reset}\n`)
  const stacks = detectStacks().map(s => s.key)
  createEagleDirs()
  createLifecycleFiles(path.basename(TARGET_DIR), stacks)
  mapCodebase(stacks)
  ok('代码库地图已生成：.eagle/codebase/')
}

// ─── HELP ────────────────────────────────────────────────────────────────────

function printHelp() {
  log(`
${c.bold}🦅 Eagle Framework CLI${c.reset}

${c.bold}用法：${c.reset}
  npx eagle <命令> [选项]

${c.bold}命令：${c.reset}
  install    安装 Eagle（插件注册 / 项目初始化）
  uninstall  卸载 Eagle
  sense      感知当前项目技术栈
  map        扫描现有项目并生成 .eagle/codebase/ 代码库地图

${c.bold}install / uninstall 选项：${c.reset}
  ${c.yellow}--user,    -u${c.reset}  用户级：修改 ~/.claude/settings.json（全局插件）
  ${c.yellow}--project, -p${c.reset}  项目级：初始化/清理当前项目 .eagle/
  ${c.yellow}--all,     -a${c.reset}  两层都操作
  ${c.dim}（无选项）      交互式选择${c.reset}

${c.bold}示例：${c.reset}
  npx eagle install             # 交互式选择安装级别
  npx eagle install --user      # 仅注册全局插件
  npx eagle install --project   # 仅初始化当前项目
  npx eagle install --all       # 两层都安装

  npx eagle uninstall --user    # 仅移除全局插件
  npx eagle uninstall --project # 仅清理当前项目
  npx eagle uninstall --all     # 彻底卸载

  npx eagle sense               # 感知当前项目
  npx eagle map                 # 生成/刷新代码库地图
`)
}

// ─── ~/.claude/settings.json 读写 ────────────────────────────────────────────

function readClaudeSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS)) return {}
  try {
    return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf8'))
  } catch {
    warn(`无法解析 ${CLAUDE_SETTINGS}，将以空配置处理`)
    return {}
  }
}

function writeClaudeSettings(settings) {
  const dir = path.dirname(CLAUDE_SETTINGS)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8')
}

// ─── Git URL 解析 ─────────────────────────────────────────────────────────────

function resolveGitUrl() {
  // 优先读 package.json repository.url
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(FRAMEWORK_DIR, 'package.json'), 'utf8'))
    if (pkg.repository?.url) return pkg.repository.url
  } catch {}

  // 回退：读 git remote origin
  try {
    return execSync('git remote get-url origin', { cwd: FRAMEWORK_DIR, stdio: 'pipe' })
      .toString().trim()
  } catch {}

  return null
}

// ─── 目录/文件工具 ───────────────────────────────────────────────────────────

function mkdirSafe(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function removeDirSafe(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function removeFileSafe(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

function isDirEmpty(dir) {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0
}

function countDirs(dir) {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
  ).length
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) n++
    else if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name))
  }
  return n
}

function copyDirSafe(src, dst) {
  mkdirSafe(dst)
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDirSafe(s, d)
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d)
  }
}

function writeIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, 'utf8')
}

function cleanGitignore() {
  const p = path.join(TARGET_DIR, '.gitignore')
  if (!fs.existsSync(p)) return
  const original = fs.readFileSync(p, 'utf8')
  const cleaned  = original
    .replace(/\n?# Eagle[^\n]*\n(\.eagle\/[^\n]+\n|\.dev\/[^\n]+\n)*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
  if (cleaned !== original) {
    fs.writeFileSync(p, cleaned, 'utf8')
    info('.gitignore Eagle 条目已清理')
  }
}

// ─── 项目初始化工具 ──────────────────────────────────────────────────────────

function detectStacks() {
  const stacks = []
  if (fs.existsSync(path.join(TARGET_DIR, 'backend', 'go.mod')))       stacks.push({ key: 'go',      label: 'Go' })
  if (hasAny([
    'backend/pyproject.toml',
    'backend/requirements.txt',
    'backend/poetry.lock',
    'backend/Pipfile',
    'pyproject.toml',
    'requirements.txt',
    'poetry.lock',
    'Pipfile'
  ])) stacks.push({ key: 'python', label: 'Python' })
  if (fs.existsSync(path.join(TARGET_DIR, 'web', 'package.json')))     stacks.push({ key: 'react',   label: 'React' })
  if (fs.existsSync(path.join(TARGET_DIR, 'mobile', 'pubspec.yaml')))  stacks.push({ key: 'flutter', label: 'Flutter' })
  return stacks
}

function hasAny(relPaths) {
  return relPaths.some(p => fs.existsSync(path.join(TARGET_DIR, p)))
}

function createEagleDirs() {
  for (const d of [
    'rules', 'components', 'knowledge', 'memory', 'tasks',
    'phases', 'codebase', 'gates', 'threads', 'backlog'
  ]) {
    mkdirSafe(path.join(TARGET_DIR, '.eagle', d))
  }
}

function createLifecycleFiles(projectName, stacks) {
  const eagleDir = path.join(TARGET_DIR, '.eagle')
  mkdirSafe(eagleDir)

  writeIfNotExists(path.join(eagleDir, 'config.json'), JSON.stringify({
    version: 1,
    projectName,
    stacks,
    workflow: {
      lifecycle: true,
      codebaseMap: true,
      qualityGates: true,
      longTermMemory: true,
      requirePlanBeforeCode: true,
      requireTestsBeforeReview: true,
      requireReviewBeforeDone: true
    },
    qualityGates: {
      plan: { enabled: true, blocksOnMissingAcceptance: true },
      tests: { enabled: true, commandPolicy: 'auto-detect' },
      review: { enabled: true, blockSeverity: 'CRITICAL' },
      memory: { enabled: true, captureDecisions: true, capturePitfalls: true }
    },
    memory: {
      decisionPrefix: 'D',
      pitfallPrefix: 'P',
      recallFiles: ['.eagle/knowledge/INDEX.md', '.eagle/memory/INDEX.md']
    },
    codebaseMap: {
      maxFiles: 300,
      maxDepth: 4,
      exclude: ['.git', '.eagle', 'node_modules', 'dist', 'build', 'coverage', '.dart_tool']
    }
  }, null, 2) + '\n')

  writeIfNotExists(path.join(eagleDir, 'PROJECT.md'), `# ${projectName}

## Vision
TODO: Describe what this project is trying to achieve.

## Users
TODO: Describe primary users and workflows.

## Constraints
- Stacks: ${stacks.length ? stacks.join(', ') : 'unknown'}

## Decisions
- No locked decisions yet.
`)

  writeIfNotExists(path.join(eagleDir, 'ROADMAP.md'), `# Roadmap

## Active Milestone

### Phase 1: Bootstrap
- Status: planned
- Goal: Initialize Eagle lifecycle, codebase map, quality gates, and memory.
- Success Criteria:
  - [ ] .eagle/config.json exists
  - [ ] .eagle/codebase/ is current
  - [ ] tasks have PLAN, TEST, REVIEW, and memory capture before done

## Backlog

- Add future ideas here or use .eagle/backlog/.
`)

  writeIfNotExists(path.join(eagleDir, 'STATE.md'), `# State

## Current Position
- Status: initialized
- Current task: none
- Current phase: none

## Recent Decisions
- None yet.

## Blockers
- None.

## Next Actions
- Run \`eagle map\` after meaningful structure changes.
- Use /eagle:lifecycle before major work to update project state.
`)

  writeIfNotExists(path.join(eagleDir, 'gates', 'QUALITY-GATES.md'), `# Quality Gates

## Required Before Coding
- DISCUSSION.md exists for non-trivial work.
- PLAN.md has acceptance criteria and wave dependencies.
- Relevant .eagle/codebase/ files were checked.

## Required Before Done
- TEST.md records executed commands and result.
- REVIEW.md has no CRITICAL findings.
- Decisions and pitfalls are captured in .eagle/knowledge/ or .eagle/memory/.

## Blockers
- Missing acceptance criteria.
- Failing tests without a documented reason.
- CRITICAL review findings.
- Changes that contradict PROJECT.md or ROADMAP.md without updating them.
`)

  writeIfNotExists(path.join(eagleDir, 'knowledge', 'INDEX.md'), '# Knowledge Index\n\nCapture reusable project decisions and implementation patterns here.\n')
  writeIfNotExists(path.join(eagleDir, 'memory', 'INDEX.md'), '# Memory Index\n\nCapture pitfalls, failed attempts, and recurring project lessons here.\n')

  const quickstart = path.join(FRAMEWORK_DIR, 'payload', 'QUICKSTART.md')
  if (fs.existsSync(quickstart)) {
    writeIfNotExists(path.join(eagleDir, 'QUICKSTART.md'), fs.readFileSync(quickstart, 'utf8'))
  }
}

function createDirectories(stacks) {
  createEagleDirs()

  if (stacks.includes('go')) {
    for (const d of [
      'backend/cmd/server',
      'backend/internal/handler/middleware',
      'backend/internal/service',
      'backend/internal/repository',
      'backend/internal/domain',
      'backend/internal/bootstrap',
      'backend/pkg/apperr',
      'backend/pkg/pagination',
      'backend/config',
      'backend/migrations',
    ]) mkdirSafe(path.join(TARGET_DIR, d))
  }

  if (stacks.includes('react')) {
    for (const d of [
      'web/src/api', 'web/src/components/ui', 'web/src/components/layout',
      'web/src/features', 'web/src/hooks', 'web/src/stores',
      'web/src/types', 'web/src/lib', 'web/src/router',
      'web/test/mocks', 'web/public',
    ]) mkdirSafe(path.join(TARGET_DIR, d))
  }

  if (stacks.includes('flutter')) {
    for (const d of [
      'mobile/lib/core/constants', 'mobile/lib/core/exceptions',
      'mobile/lib/core/extensions', 'mobile/lib/core/network',
      'mobile/lib/core/router',    'mobile/lib/core/theme',
      'mobile/lib/features',
      'mobile/lib/shared/widgets', 'mobile/lib/shared/providers',
      'mobile/test/helpers',
    ]) mkdirSafe(path.join(TARGET_DIR, d))
  }

  ok('目录结构创建完成')
}

function copyRules(stacks) {
  const dstRules = path.join(TARGET_DIR, '.eagle', 'rules')
  for (const stack of stacks) {
    const src = path.join(FRAMEWORK_DIR, 'payload', `rules-${stack}`)
    if (fs.existsSync(src)) {
      copyDirSafe(src, path.join(dstRules, stack))
      info(`  .eagle/rules/${stack}/ 已复制`)
    } else {
      warn(`  规范目录不存在：${src}`)
    }
  }
}

function copyAvailableRules() {
  const payloadDir = path.join(FRAMEWORK_DIR, 'payload')
  if (!fs.existsSync(payloadDir)) return

  const stacks = fs.readdirSync(payloadDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('rules-'))
    .map(entry => entry.name.replace(/^rules-/, ''))

  copyRules(stacks)
}

function copyComponents() {
  const payloadDir = path.join(FRAMEWORK_DIR, 'payload')
  if (!fs.existsSync(payloadDir)) return
  let copied = 0
  for (const entry of fs.readdirSync(payloadDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('component-')) continue
    const componentName = entry.name.replace(/^component-/, '')
    copyDirSafe(path.join(payloadDir, entry.name), path.join(TARGET_DIR, '.eagle', 'components', componentName))
    copied++
  }
  if (copied > 0) {
    ok('组件蓝图已复制')
  }
}

function mapCodebase(stacks) {
  const codebaseDir = path.join(TARGET_DIR, '.eagle', 'codebase')
  mkdirSafe(codebaseDir)

  const files = listProjectFiles(TARGET_DIR, {
    exclude: new Set(['.git', '.eagle', 'node_modules', 'dist', 'build', 'coverage', '.dart_tool']),
    maxFiles: 300,
    maxDepth: 4
  })

  fs.writeFileSync(path.join(codebaseDir, 'STACK.md'), renderStackMap(stacks), 'utf8')
  fs.writeFileSync(path.join(codebaseDir, 'STRUCTURE.md'), renderStructureMap(files), 'utf8')
  fs.writeFileSync(path.join(codebaseDir, 'TESTING.md'), renderTestingMap(stacks), 'utf8')
  fs.writeFileSync(path.join(codebaseDir, 'CONVENTIONS.md'), renderConventionsMap(stacks, files), 'utf8')
  fs.writeFileSync(path.join(codebaseDir, 'README.md'), `# Codebase Map

Generated by \`eagle map\`.

- \`STACK.md\`: detected stacks and important manifest files.
- \`STRUCTURE.md\`: high-signal project tree.
- \`TESTING.md\`: likely test commands and test locations.
- \`CONVENTIONS.md\`: inferred project conventions for agents to follow.

Refresh this map after large structure changes.
`, 'utf8')
}

function listProjectFiles(root, opts, rel = '', depth = 0, acc = []) {
  if (acc.length >= opts.maxFiles || depth > opts.maxDepth) return acc
  const dir = path.join(root, rel)
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (acc.length >= opts.maxFiles) break
    if (opts.exclude.has(entry.name)) continue
    const nextRel = rel ? path.join(rel, entry.name) : entry.name
    if (entry.isDirectory()) {
      acc.push(nextRel + path.sep)
      listProjectFiles(root, opts, nextRel, depth + 1, acc)
    } else {
      acc.push(nextRel)
    }
  }
  return acc
}

function renderStackMap(stacks) {
  const manifestRows = [
    ['Go backend', 'backend/go.mod'],
    ['Python backend', 'backend/pyproject.toml or backend/requirements.txt'],
    ['React web', 'web/package.json'],
    ['Flutter mobile', 'mobile/pubspec.yaml'],
    ['Python root', 'pyproject.toml or requirements.txt'],
    ['Root package', 'package.json']
  ].map(([label, file]) => `- ${label}: ${manifestDetected(file) || 'not detected'}`).join('\n')

  return `# Stack Map

## Detected Stacks
${stacks.length ? stacks.map(s => `- ${s}`).join('\n') : '- unknown'}

## Manifest Files
${manifestRows}

## Agent Notes
- Prefer existing project conventions over generic framework defaults.
- Read this file and STRUCTURE.md before planning cross-stack work.
`
}

function renderStructureMap(files) {
  return `# Structure Map

## Project Tree

\`\`\`text
${files.join('\n')}
\`\`\`

## Agent Notes
- Treat this as a navigation aid, not a complete inventory.
- Refresh with \`eagle map\` after creating or moving major directories.
`
}

function renderTestingMap(stacks) {
  const commands = []
  if (stacks.includes('go')) commands.push('- Go: `cd backend && go test ./...`')
  if (stacks.includes('python')) commands.push('- Python: `pytest` or `cd backend && pytest`')
  if (stacks.includes('react')) commands.push('- React: `cd web && npm test` or `cd web && npx vitest run`')
  if (stacks.includes('flutter')) commands.push('- Flutter: `cd mobile && flutter test`')
  if (commands.length === 0 && fs.existsSync(path.join(TARGET_DIR, 'package.json'))) {
    commands.push('- Root Node project: `npm test`')
  }

  return `# Testing Map

## Likely Commands
${commands.length ? commands.join('\n') : '- No test command detected yet.'}

## Test Locations
- Go: files matching \`*_test.go\`
- Python: files matching \`test_*.py\`, \`*_test.py\`, or \`tests/\`
- React: \`web/src/**/*.test.*\`, \`web/test/\`
- Flutter: \`mobile/test/\`

## Gate Policy
- Full delivery requires TEST.md with commands, result, and failures if any.
- Failing tests block completion unless the failure is explicitly out of scope and recorded in REVIEW.md.
`
}

function renderConventionsMap(stacks, files) {
  const notes = []
  if (stacks.includes('go')) notes.push('- Go code should follow `.eagle/rules/go/INDEX.md` and existing `backend/internal` boundaries.')
  if (stacks.includes('python')) notes.push('- Python code should follow `.eagle/rules/python/INDEX.md`, existing package boundaries, type hints, and nearby test style.')
  if (stacks.includes('react')) notes.push('- React code should follow `.eagle/rules/react/INDEX.md` and existing feature/component boundaries.')
  if (stacks.includes('flutter')) notes.push('- Flutter code should follow `.eagle/rules/flutter/INDEX.md` and existing `lib/features` boundaries.')
  if (files.some(f => f.includes('migrations'))) notes.push('- Database changes should include migration files and rollback notes.')
  if (files.some(f => f.includes('api') || f.includes('handler'))) notes.push('- API changes should update contracts used by every affected client.')

  return `# Conventions Map

## Inferred Conventions
${notes.length ? notes.join('\n') : '- No strong conventions detected yet. Prefer nearby file patterns.'}

## Agent Rules
- Before coding, read the relevant stack rules and nearby files.
- Do not introduce a new architecture pattern when an existing local pattern fits.
- Capture reusable decisions in \`.eagle/knowledge/INDEX.md\`.
- Capture pitfalls and failed attempts in \`.eagle/memory/INDEX.md\`.
`
}

function manifestDetected(pattern) {
  const candidates = pattern.split(/\s+or\s+/)
  const found = candidates.find(file => fs.existsSync(path.join(TARGET_DIR, file)))
  return found || null
}

function generateSkeletons(stacks, projectName) {
  const tplDir = path.join(FRAMEWORK_DIR, 'templates')

  if (stacks.includes('go')) {
    generateFromTemplate(path.join(tplDir, 'go', 'go.mod.tpl'),      path.join(TARGET_DIR, 'backend', 'go.mod'),                      { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'go', 'main.go.tpl'),     path.join(TARGET_DIR, 'backend', 'cmd', 'server', 'main.go'),     { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'go', 'config.yaml.tpl'), path.join(TARGET_DIR, 'backend', 'config', 'config.yaml'),        {})
    writeIfNotExists(path.join(TARGET_DIR, 'backend', '.gitignore'), '# Go\n*.exe\n*.test\ncoverage.out\n.env\n')
    ok('Go 骨架已生成')
  }

  if (stacks.includes('react')) {
    generateFromTemplate(path.join(tplDir, 'react', 'package.json.tpl'),  path.join(TARGET_DIR, 'web', 'package.json'),   { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'react', 'vite.config.ts.tpl'), path.join(TARGET_DIR, 'web', 'vite.config.ts'), {})
    writeIfNotExists(path.join(TARGET_DIR, 'web', '.gitignore'), 'node_modules\ndist\n.env.local\n.env.production\ncoverage\n')
    writeIfNotExists(path.join(TARGET_DIR, 'web', '.env'),       'VITE_API_BASE_URL=http://localhost:8080\n')
    ok('React 骨架已生成')
  }

  if (stacks.includes('flutter')) {
    generateFromTemplate(path.join(tplDir, 'flutter', 'pubspec.yaml.tpl'), path.join(TARGET_DIR, 'mobile', 'pubspec.yaml'), { PROJECT_NAME: projectName })
    writeIfNotExists(path.join(TARGET_DIR, 'mobile', '.gitignore'), '.dart_tool\n.flutter-plugins\n.flutter-plugins-dependencies\nbuild\n')
    ok('Flutter 骨架已生成')
  }
}

function generateFromTemplate(tplPath, dstPath, vars) {
  if (!fs.existsSync(tplPath)) { warn(`模板不存在：${tplPath}`); return }
  if (fs.existsSync(dstPath))  { info(`  已存在，跳过：${path.relative(TARGET_DIR, dstPath)}`); return }
  let content = fs.readFileSync(tplPath, 'utf8')
  for (const [k, v] of Object.entries(vars)) content = content.replaceAll(`{{${k}}}`, v)
  fs.writeFileSync(dstPath, content, 'utf8')
}

function initGit() {
  try {
    execSync('git init', { cwd: TARGET_DIR, stdio: 'pipe' })
    const ignoreLines = [
      '', '# Eagle — 项目私有（不提交）',
      '.eagle/knowledge/', '.eagle/memory/', '.eagle/tasks/', '.eagle/threads/', '',
      '# 环境变量', '.env.local', '.env.production', '',
    ].join('\n')
    const p = path.join(TARGET_DIR, '.gitignore')
    fs.existsSync(p)
      ? fs.appendFileSync(p, ignoreLines)
      : fs.writeFileSync(p, ignoreLines.trimStart())
    execSync('git add .', { cwd: TARGET_DIR, stdio: 'pipe' })
    execSync('git commit -m "chore: init project with Eagle Framework"', { cwd: TARGET_DIR, stdio: 'pipe' })
    ok('git 初始化完成')
  } catch (e) {
    warn(`git 初始化失败：${e.message}`)
  }
}

// ─── 启动 ────────────────────────────────────────────────────────────────────

main().catch(e => {
  err(e.message)
  rl.close()
  process.exit(1)
})
