#!/usr/bin/env node
'use strict'

const fs   = require('fs')
const path = require('path')
const os   = require('os')
const { execFileSync, execSync } = require('child_process')
const readline = require('readline')

const FRAMEWORK_DIR       = path.join(__dirname, '..')
const TARGET_DIR          = process.cwd()
const USER_HOME           = os.homedir()
const USER_CLAUDE_DIR     = path.join(USER_HOME, '.claude')
const USER_CODEX_SKILLS_DIR = path.join(USER_HOME, '.agents', 'skills')
const USER_CODEX_AGENTS_DIR = path.join(USER_HOME, '.codex', 'agents')
const CLAUDE_SETTINGS     = path.join(USER_CLAUDE_DIR, 'settings.json')
const PLUGIN_KEY          = 'eagle@eagle-framework'
const DEFAULT_RUNTIME_NAMES = ['claude', 'codex']

const RUNTIME_ADAPTERS = {
  claude: {
    name: 'claude',
    label: 'Claude Code',
    sourceDir: path.join(FRAMEWORK_DIR, 'plugin', 'claude'),
    userRoot: USER_CLAUDE_DIR,
    projectRoot: path.join(TARGET_DIR, '.claude'),
    install: installClaudeRuntime,
    remove: removeClaudeRuntime,
  },
  codex: {
    name: 'codex',
    label: 'Codex',
    sourceDir: path.join(FRAMEWORK_DIR, 'plugin', 'codex'),
    userRoot: {
      skills: USER_CODEX_SKILLS_DIR,
      agents: USER_CODEX_AGENTS_DIR,
    },
    projectRoot: {
      skills: path.join(TARGET_DIR, '.agents', 'skills'),
      agents: path.join(TARGET_DIR, '.codex', 'agents'),
    },
    install: installCodexRuntime,
    remove: removeCodexRuntime,
  },
}

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
  const hasClaude  = flags.includes('--claude')
  const hasCodex   = flags.includes('--codex')
  const runtimeNames = []
  if (hasClaude) runtimeNames.push('claude')
  if (hasCodex)  runtimeNames.push('codex')

  // --all 等价于同时指定 --user --project
  const opts = {
    user:    hasUser || hasAll,
    project: hasProject || hasAll,
    runtimeNames,
    runtimeInteractive: runtimeNames.length === 0,
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
    log('  [1] 用户级  — 安装 runtime skills/agents 到用户目录')
    log('  [2] 项目级  — 安装 runtime skills/agents 到当前项目，并初始化 .eagle/')
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

  const runtimeNames = await resolveRuntimeNames(opts, '安装')
  if (!runtimeNames) return

  syncRuntimeSources(runtimeNames)

  if (user)    await installUser(runtimeNames)
  if (project) await installProject(runtimeNames)
}

// ── 用户级安装：写入 ~/.claude/ ───────────────────────────────────────────────

async function installUser(runtimeNames) {
  log(`${c.bold}[用户级] 安装 Eagle skills / agents${c.reset}`)
  installRuntimeScope('user', runtimeNames)
  removeLegacyPluginRegistration()
  ok('用户级安装完成')
  dim(`  已安装 runtime：${runtimeLabels(runtimeNames)}。重启对应客户端后生效`)
  log('')
}

// ── 项目级安装：接入当前项目，不改变业务项目结构 ─────────────────────────────

async function installProject(runtimeNames) {
  log(`${c.bold}[项目级] 接入当前项目${c.reset}`)

  const eagleDir = path.join(TARGET_DIR, '.eagle')
  const hadEagleDir = fs.existsSync(eagleDir)
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
  if (hadEagleDir) {
    info('检测到已有 .eagle/，将保留项目状态、记忆、任务和已有代码库地图文件')
  }
  createEagleDirs()

  log('🧠 安装项目级 runtime skills / agents...')
  installRuntimeScope('project', runtimeNames)

  log('📋 复制编码规范...')
  copyAvailableRules()

  log('🧩 复制组件蓝图...')
  copyComponents()

  log('🧭 初始化生命周期文件...')
  createLifecycleFiles(projectName, stacks)

  log('🗺️ 生成代码库地图...')
  mapCodebase(stacks, { overwrite: !hadEagleDir })

  log('')
  ok(`项目级接入完成："${projectName}"`)
  dim(`  已安装 runtime：${runtimeLabels(runtimeNames)}。重启对应客户端后，当前项目可使用 Eagle skills / agents`)
  log('')
}

// ─── UNINSTALL ───────────────────────────────────────────────────────────────

async function uninstallCommand(opts) {
  log(`\n${c.bold}🦅 Eagle Framework — 卸载${c.reset}\n`)

  let { user, project } = opts

  if (opts.interactive) {
    log('选择卸载级别（可多选，空格分隔）：')
    log('  [1] 用户级  — 删除用户目录中的 Eagle runtime')
    log('  [2] 项目级  — 删除当前项目中的 Eagle runtime 和 .eagle/')
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

  const runtimeNames = await resolveRuntimeNames(opts, '卸载')
  if (!runtimeNames) return

  if (user)    await uninstallUser(runtimeNames)
  if (project) await uninstallProject(runtimeNames)
}

// ── 用户级卸载：清理 ~/.claude/ Eagle runtime ────────────────────────────────

async function uninstallUser(runtimeNames) {
  log(`${c.bold}[用户级] 删除 Eagle skills / agents${c.reset}`)
  removeRuntimeScope('user', runtimeNames)
  removeLegacyPluginRegistration()
  ok('用户级卸载完成')
  dim('  重启对应客户端后生效')
  log('')
}

// ── 项目级卸载：清理 .claude/ Eagle runtime + .eagle/ ─────────────────────────

async function uninstallProject(runtimeNames) {
  log(`${c.bold}[项目级] 清理当前项目 Eagle 安装${c.reset}`)

  const eagleDir = path.join(TARGET_DIR, '.eagle')

  removeRuntimeScope('project', runtimeNames)

  if (selectedAllRuntimes(runtimeNames) && fs.existsSync(eagleDir)) {
    removeDirSafe(eagleDir)
    ok('.eagle/ 已删除')
  } else if (selectedAllRuntimes(runtimeNames)) {
    info('未找到 .eagle/，跳过')
  } else {
    info('仅卸载部分 runtime，保留共享 .eagle/')
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
  ${c.yellow}--user,    -u${c.reset}  用户级：安装/清理 Eagle runtime
  ${c.yellow}--project, -p${c.reset}  项目级：安装/清理当前项目 runtime + .eagle/
  ${c.yellow}--all,     -a${c.reset}  两层都操作
  ${c.yellow}--claude${c.reset}        只操作 Claude Code runtime
  ${c.yellow}--codex${c.reset}         只操作 Codex runtime
  ${c.dim}（无 runtime 选项）  交互式选择 Claude / Codex / 全部${c.reset}

${c.bold}示例：${c.reset}
  npx eagle install             # 交互式选择安装级别
  npx eagle install --user      # 仅安装用户级 runtime
  npx eagle install --project   # 仅安装到当前项目
  npx eagle install --project --codex
  npx eagle install --project --claude --codex
  npx eagle install --all       # 两层都安装

  npx eagle uninstall --user    # 仅清理用户级 runtime
  npx eagle uninstall --project # 仅清理当前项目 Eagle runtime
  npx eagle uninstall --project --claude
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

function copyDirOverwrite(src, dst) {
  if (!fs.existsSync(src)) return
  removeDirSafe(dst)
  mkdirSafe(dst)
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDirOverwrite(s, d)
    else fs.copyFileSync(s, d)
  }
}

function listVisibleEntries(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
}

async function resolveRuntimeNames(opts, actionLabel) {
  if (!opts.runtimeInteractive) return opts.runtimeNames

  log(`选择${actionLabel} runtime（可多选，空格分隔）：`)
  log('  [1] Claude Code')
  log('  [2] Codex')
  log('  [3] 全部')
  log('')
  const input = await ask('输入编号 (例: 1 2 或 3): ')
  const nums = input.split(/\s+/).map(Number)
  const runtimeNames = []
  if (nums.includes(1) || nums.includes(3)) runtimeNames.push('claude')
  if (nums.includes(2) || nums.includes(3)) runtimeNames.push('codex')

  if (runtimeNames.length === 0) {
    err(`未选择${actionLabel} runtime，已取消`)
    return null
  }
  log('')
  return runtimeNames
}

function runtimeAdapters(runtimeNames = DEFAULT_RUNTIME_NAMES) {
  return runtimeNames.map(name => {
    const adapter = RUNTIME_ADAPTERS[name]
    if (!adapter) throw new Error(`Unknown Eagle runtime adapter: ${name}`)
    return adapter
  })
}

function runtimeRoot(adapter, scope) {
  return scope === 'user' ? adapter.userRoot : adapter.projectRoot
}

function runtimeLabels(runtimeNames = DEFAULT_RUNTIME_NAMES) {
  return runtimeAdapters(runtimeNames).map(adapter => adapter.label).join(', ')
}

function selectedAllRuntimes(runtimeNames) {
  return DEFAULT_RUNTIME_NAMES.every(name => runtimeNames.includes(name))
}

function syncRuntimeSources(runtimeNames) {
  if (!runtimeNames.includes('codex')) return

  const script = path.join(FRAMEWORK_DIR, 'scripts', 'generate-codex-runtime.js')
  if (!fs.existsSync(script)) {
    warn(`  Codex sync script not found: ${script}`)
    return
  }

  info('  同步 Codex runtime...')
  try {
    const output = execFileSync(process.execPath, [script], {
      cwd: FRAMEWORK_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    if (output) dim(`  ${output}`)
  } catch (e) {
    const detail = e.stderr?.toString().trim() || e.message
    throw new Error(`Codex runtime sync failed: ${detail}`)
  }
}

function installRuntimeScope(scope, runtimeNames) {
  for (const adapter of runtimeAdapters(runtimeNames)) {
    const root = runtimeRoot(adapter, scope)
    info(`  runtime: ${adapter.label}`)
    adapter.install(root, scope, adapter)
  }
}

function removeRuntimeScope(scope, runtimeNames) {
  for (const adapter of runtimeAdapters(runtimeNames)) {
    const root = runtimeRoot(adapter, scope)
    info(`  runtime: ${adapter.label}`)
    adapter.remove(root, scope, adapter)
  }
}

function installClaudeRuntime(claudeRoot, scope, adapter) {
  const pluginDir = adapter.sourceDir
  if (!fs.existsSync(pluginDir)) {
    warn(`  runtime source not found: ${pluginDir}`)
    return
  }

  const agentsSrc = path.join(pluginDir, 'agents')
  const skillsSrc = path.join(pluginDir, 'skills')
  const scriptsSrc = path.join(pluginDir, 'scripts')
  const hooksSrc = path.join(pluginDir, 'hooks')

  const agentsDst = path.join(claudeRoot, 'agents')
  const skillsDst = path.join(claudeRoot, 'skills')
  const scriptsDst = path.join(claudeRoot, 'scripts', 'eagle')
  const hooksDst = path.join(claudeRoot, 'hooks', 'eagle')

  mkdirSafe(agentsDst)
  mkdirSafe(skillsDst)

  if (fs.existsSync(agentsSrc)) {
    for (const entry of fs.readdirSync(agentsSrc, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const base = path.basename(entry.name, '.md')
      fs.copyFileSync(path.join(agentsSrc, entry.name), path.join(agentsDst, `eagle-${base}.md`))
    }
  }

  if (fs.existsSync(skillsSrc)) {
    for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      copyDirOverwrite(path.join(skillsSrc, entry.name), path.join(skillsDst, `eagle-${entry.name}`))
    }
  }

  copyDirOverwrite(scriptsSrc, scriptsDst)
  copyDirOverwrite(hooksSrc, hooksDst)
  upsertEagleHook(claudeRoot, scope)

  info(`  agents → ${path.relative(TARGET_DIR, agentsDst) || agentsDst}`)
  info(`  skills → ${path.relative(TARGET_DIR, skillsDst) || skillsDst}`)
  info(`  scripts → ${path.relative(TARGET_DIR, scriptsDst) || scriptsDst}`)
}

function removeClaudeRuntime(claudeRoot, scope) {
  const agentsDir = path.join(claudeRoot, 'agents')
  const skillsDir = path.join(claudeRoot, 'skills')

  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.startsWith('eagle-') && entry.name.endsWith('.md')) {
        removeFileSafe(path.join(agentsDir, entry.name))
      }
    }
  }

  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('eagle-')) {
        removeDirSafe(path.join(skillsDir, entry.name))
      }
    }
  }

  removeDirSafe(path.join(claudeRoot, 'scripts', 'eagle'))
  removeDirSafe(path.join(claudeRoot, 'hooks', 'eagle'))
  removeEagleHook(claudeRoot)
  pruneEmptyDirs([
    path.join(claudeRoot, 'agents'),
    path.join(claudeRoot, 'skills'),
    path.join(claudeRoot, 'scripts'),
    path.join(claudeRoot, 'hooks'),
    claudeRoot
  ], scope === 'project')
}

function installCodexRuntime(codexRoot, scope, adapter) {
  const pluginDir = adapter.sourceDir
  if (!fs.existsSync(pluginDir)) {
    warn(`  runtime source not found: ${pluginDir}`)
    return
  }

  const skillsSrc = path.join(pluginDir, 'skills')
  const agentsSrc = path.join(pluginDir, 'agents')
  const skillsDst = codexRoot.skills
  const agentsDst = codexRoot.agents

  mkdirSafe(skillsDst)
  mkdirSafe(agentsDst)

  let copiedSkills = 0
  for (const entry of listVisibleEntries(skillsSrc)) {
    if (!entry.isDirectory()) continue
    copyDirOverwrite(path.join(skillsSrc, entry.name), path.join(skillsDst, entry.name))
    copiedSkills++
  }

  let copiedAgents = 0
  for (const entry of listVisibleEntries(agentsSrc)) {
    if (!entry.isFile() || !entry.name.endsWith('.toml')) continue
    fs.copyFileSync(path.join(agentsSrc, entry.name), path.join(agentsDst, entry.name))
    copiedAgents++
  }

  info(`  skills → ${path.relative(TARGET_DIR, skillsDst) || skillsDst}`)
  info(`  agents → ${path.relative(TARGET_DIR, agentsDst) || agentsDst}`)
  if (copiedSkills === 0 && copiedAgents === 0) {
    warn('  Codex runtime source is present but has no converted skills or agents yet')
  }
}

function removeCodexRuntime(codexRoot, scope) {
  const skillsDir = codexRoot.skills
  const agentsDir = codexRoot.agents

  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('eagle-')) {
        removeDirSafe(path.join(skillsDir, entry.name))
      }
    }
  }

  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.startsWith('eagle-') && entry.name.endsWith('.toml')) {
        removeFileSafe(path.join(agentsDir, entry.name))
      }
    }
  }

  pruneEmptyDirs([
    skillsDir,
    path.dirname(skillsDir),
    agentsDir,
    path.dirname(agentsDir)
  ], scope === 'project')
}

function upsertEagleHook(claudeRoot, scope) {
  const settingsPath = path.join(claudeRoot, 'settings.json')
  const settings = readJsonFile(settingsPath)
  const scriptPath = scope === 'user'
    ? path.join(claudeRoot, 'scripts', 'eagle', 'detect_project.py')
    : path.join('.claude', 'scripts', 'eagle', 'detect_project.py')
  const command = `python "${scriptPath}"`

  settings.hooks = settings.hooks || {}
  settings.hooks.SessionStart = Array.isArray(settings.hooks.SessionStart) ? settings.hooks.SessionStart : []

  const alreadyExists = settings.hooks.SessionStart.some(entry =>
    Array.isArray(entry.hooks) && entry.hooks.some(h => h.command === command)
  )
  if (!alreadyExists) {
    settings.hooks.SessionStart.push({
      hooks: [{ type: 'command', command }]
    })
  }

  writeJsonFile(settingsPath, settings)
}

function removeEagleHook(claudeRoot) {
  const settingsPath = path.join(claudeRoot, 'settings.json')
  if (!fs.existsSync(settingsPath)) return
  const settings = readJsonFile(settingsPath)
  removeEagleHooksFromSettings(settings)
  if (Object.keys(settings).length === 0) removeFileSafe(settingsPath)
  else writeJsonFile(settingsPath, settings)
}

function removeEagleHooksFromSettings(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return
  for (const [eventName, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue
    settings.hooks[eventName] = entries
      .map(entry => ({
        ...entry,
        hooks: Array.isArray(entry.hooks)
          ? entry.hooks.filter(h => !isEagleHookCommand(h.command))
          : entry.hooks
      }))
      .filter(entry => !Array.isArray(entry.hooks) || entry.hooks.length > 0)
    if (settings.hooks[eventName].length === 0) delete settings.hooks[eventName]
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks
}

function isEagleHookCommand(command) {
  return typeof command === 'string'
    && (command.includes('scripts/eagle/detect_project.py')
      || command.includes('scripts\\eagle\\detect_project.py')
      || command.includes('${CLAUDE_PLUGIN_ROOT}/scripts/detect_project.py'))
}

function removeLegacyPluginRegistration() {
  if (!fs.existsSync(CLAUDE_SETTINGS)) return
  const settings = readClaudeSettings()
  const gitUrl = resolveGitUrl()

  if (Array.isArray(settings.pluginMarketplaces) && gitUrl) {
    settings.pluginMarketplaces = settings.pluginMarketplaces.filter(u => u !== gitUrl)
    if (settings.pluginMarketplaces.length === 0) delete settings.pluginMarketplaces
  }

  if (settings.enabledPlugins && settings.enabledPlugins[PLUGIN_KEY] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_KEY]
    if (Object.keys(settings.enabledPlugins).length === 0) delete settings.enabledPlugins
  }

  writeClaudeSettings(settings)
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    warn(`无法解析 ${filePath}，将以空配置处理`)
    return {}
  }
}

function writeJsonFile(filePath, value) {
  mkdirSafe(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function pruneEmptyDirs(dirs, includeRoot = false) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue
    if (isDirEmpty(dir) && (includeRoot || dir !== dirs[dirs.length - 1])) {
      fs.rmdirSync(dir)
    }
  }
}

function writeIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, 'utf8')
}

function writeGeneratedFile(filePath, content, overwrite = true) {
  if (!overwrite && fs.existsSync(filePath)) return 'skipped'
  mkdirSafe(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
  return 'written'
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
  if (fs.existsSync(path.join(TARGET_DIR, 'backend', 'go.mod')))         stacks.push({ key: 'go',      label: 'Go' })
  if (fs.existsSync(path.join(TARGET_DIR, 'backend', 'pyproject.toml'))
    || fs.existsSync(path.join(TARGET_DIR, 'pyproject.toml')))            stacks.push({ key: 'python',  label: 'Python' })
  if (fs.existsSync(path.join(TARGET_DIR, 'web', 'next.config.ts'))
    || fs.existsSync(path.join(TARGET_DIR, 'web', 'next.config.js'))
    || fs.existsSync(path.join(TARGET_DIR, 'web', 'next.config.mjs')))   stacks.push({ key: 'nextjs',  label: 'Next.js' })
  if (fs.existsSync(path.join(TARGET_DIR, 'mobile', 'pubspec.yaml')))    stacks.push({ key: 'flutter', label: 'Flutter' })
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

  if (stacks.includes('python')) {
    for (const d of [
      'backend/app/api/v1',
      'backend/app/services', 'backend/app/repositories',
      'backend/app/models', 'backend/app/schemas',
      'backend/app/core', 'backend/app/db',
      'backend/tests', 'backend/alembic/versions',
    ]) mkdirSafe(path.join(TARGET_DIR, d))
  }

  if (stacks.includes('nextjs')) {
    for (const d of [
      'web/src/app',
      'web/src/components/ui', 'web/src/components/layout',
      'web/src/features', 'web/src/hooks', 'web/src/stores',
      'web/src/types', 'web/src/lib',
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
      copyDirOverwrite(src, path.join(dstRules, stack))
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
    copyDirOverwrite(path.join(payloadDir, entry.name), path.join(TARGET_DIR, '.eagle', 'components', componentName))
    copied++
  }
  if (copied > 0) {
    ok('组件蓝图已复制')
  }
}

function mapCodebase(stacks, opts = {}) {
  const codebaseDir = path.join(TARGET_DIR, '.eagle', 'codebase')
  mkdirSafe(codebaseDir)
  const overwrite = opts.overwrite !== false

  const files = listProjectFiles(TARGET_DIR, {
    exclude: new Set(['.git', '.eagle', 'node_modules', 'dist', 'build', 'coverage', '.dart_tool']),
    maxFiles: 300,
    maxDepth: 4
  })

  const results = [
    writeGeneratedFile(path.join(codebaseDir, 'STACK.md'), renderStackMap(stacks), overwrite),
    writeGeneratedFile(path.join(codebaseDir, 'STRUCTURE.md'), renderStructureMap(files), overwrite),
    writeGeneratedFile(path.join(codebaseDir, 'TESTING.md'), renderTestingMap(stacks), overwrite),
    writeGeneratedFile(path.join(codebaseDir, 'CONVENTIONS.md'), renderConventionsMap(stacks, files), overwrite),
    writeGeneratedFile(path.join(codebaseDir, 'README.md'), `# Codebase Map

Generated by \`eagle map\`.

- \`STACK.md\`: detected stacks and important manifest files.
- \`STRUCTURE.md\`: high-signal project tree.
- \`TESTING.md\`: likely test commands and test locations.
- \`CONVENTIONS.md\`: inferred project conventions for agents to follow.

Refresh this map after large structure changes.
`, overwrite)
  ]

  const skipped = results.filter(result => result === 'skipped').length
  if (skipped > 0) {
    info(`  已保留 ${skipped} 个已有 .eagle/codebase 文件；如需刷新请显式运行 eagle map`)
  }
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
    ['Python backend', 'backend/pyproject.toml'],
    ['Next.js web', 'web/next.config.ts'],
    ['Flutter mobile', 'mobile/pubspec.yaml'],
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
  if (stacks.includes('python')) commands.push('- Python: `cd backend && pytest -v`')
  if (stacks.includes('nextjs')) commands.push('- Next.js: `cd web && npm test` or `cd web && npx jest run`')
  if (stacks.includes('flutter')) commands.push('- Flutter: `cd mobile && flutter test`')
  if (commands.length === 0 && fs.existsSync(path.join(TARGET_DIR, 'package.json'))) {
    commands.push('- Root Node project: `npm test`')
  }

  return `# Testing Map

## Likely Commands
${commands.length ? commands.join('\n') : '- No test command detected yet.'}

## Test Locations
- Go: files matching \`*_test.go\`
- Python: \`tests/test_*.py\`, \`*_test.py\`
- Next.js: \`web/src/**/*.test.*\`, \`web/__tests__/\`, \`web/test/\`
- Flutter: \`mobile/test/\`

## Gate Policy
- Full delivery requires TEST.md with commands, result, and failures if any.
- Failing tests block completion unless the failure is explicitly out of scope and recorded in REVIEW.md.
`
}

function renderConventionsMap(stacks, files) {
  const notes = []
  if (stacks.includes('go')) notes.push('- Go code should follow `.eagle/rules/go/INDEX.md` and existing `backend/internal` boundaries.')
  if (stacks.includes('python')) notes.push('- Python code should follow `.eagle/rules/python/INDEX.md` and existing `backend/app` package boundaries.')
  if (stacks.includes('nextjs')) notes.push('- Next.js code should follow `.eagle/rules/nextjs/INDEX.md` and existing feature/component boundaries.')
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

  if (stacks.includes('python')) {
    generateFromTemplate(path.join(tplDir, 'python', 'pyproject.toml.tpl'), path.join(TARGET_DIR, 'backend', 'pyproject.toml'),    { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'python', 'main.py.tpl'),        path.join(TARGET_DIR, 'backend', 'app', 'main.py'),    { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'python', 'config.yaml.tpl'),    path.join(TARGET_DIR, 'backend', 'config.yaml'),        {})
    writeIfNotExists(path.join(TARGET_DIR, 'backend', '.env.example'), '# Environment\nDATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/{{PROJECT_NAME}}\nJWT_SECRET=change-me\n')
    ok('Python 骨架已生成')
  }

  if (stacks.includes('nextjs')) {
    generateFromTemplate(path.join(tplDir, 'nextjs', 'package.json.tpl'),   path.join(TARGET_DIR, 'web', 'package.json'),    { PROJECT_NAME: projectName })
    generateFromTemplate(path.join(tplDir, 'nextjs', 'next.config.ts.tpl'), path.join(TARGET_DIR, 'web', 'next.config.ts'),  {})
    writeIfNotExists(path.join(TARGET_DIR, 'web', '.gitignore'), 'node_modules\n.next\n.env.local\n.env.production\ncoverage\n')
    writeIfNotExists(path.join(TARGET_DIR, 'web', '.env'),       'NEXT_PUBLIC_API_BASE_URL=http://localhost:8080\n')
    ok('Next.js 骨架已生成')
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
