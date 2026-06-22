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

// ── 项目级安装：复制规范 + 生成骨架 ─────────────────────────────────────────

async function installProject() {
  log(`${c.bold}[项目级] 初始化当前项目${c.reset}`)

  // 1. 项目名
  const projectName = (await ask('项目名称（用于 go.mod / package.json）: ')).trim()
  if (!projectName) { err('项目名称不能为空'); return }

  // 2. 选择技术栈
  log('\n选择技术栈（可多选，空格分隔编号）:')
  log('  [1] Go 后端（backend/）')
  log('  [2] React Web（web/）')
  log('  [3] Flutter 移动端（mobile/）')
  const stackInput   = await ask('\n输入编号 (例: 1 2 3): ')
  const selectedNums = stackInput.split(/\s+/).map(Number).filter(n => [1,2,3].includes(n))

  if (selectedNums.length === 0) { err('至少选择一个技术栈'); return }

  const stackMap = { 1: 'go', 2: 'react', 3: 'flutter' }
  const stacks   = selectedNums.map(n => stackMap[n])

  log('')
  info(`将初始化：${stacks.join(' + ')} 项目`)
  const confirm = await ask('确认？(Y/n) ')
  if (confirm.toLowerCase() === 'n') { log('已取消'); return }

  log('\n📁 创建目录结构...')
  createDirectories(stacks)

  log('📋 复制编码规范...')
  copyRules(stacks)

  log('🧩 复制组件蓝图...')
  copyComponents()

  log('⚙️  生成骨架文件...')
  generateSkeletons(stacks, projectName)

  if (!fs.existsSync(path.join(TARGET_DIR, '.git'))) {
    log('🔧 初始化 git...')
    initGit()
  } else {
    info('已有 .git 目录，跳过 git init')
  }

  log('')
  ok(`项目级安装完成："${projectName}"`)
  dim('  运行 /discuss 开始第一个功能开发')
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
    .replace(/\n?# Eagle[^\n]*\n(\.dev\/[^\n]+\n)*/g, '')
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
  if (fs.existsSync(path.join(TARGET_DIR, 'web', 'package.json')))     stacks.push({ key: 'react',   label: 'React' })
  if (fs.existsSync(path.join(TARGET_DIR, 'mobile', 'pubspec.yaml')))  stacks.push({ key: 'flutter', label: 'Flutter' })
  return stacks
}

function createEagleDirs() {
  for (const d of ['rules', 'components', 'knowledge', 'memory', 'tasks']) {
    mkdirSafe(path.join(TARGET_DIR, '.eagle', d))
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
  const srcRules = path.join(FRAMEWORK_DIR, '.eagle', 'rules')
  const dstRules = path.join(TARGET_DIR, '.eagle', 'rules')
  for (const stack of stacks) {
    const src = path.join(srcRules, stack)
    if (fs.existsSync(src)) {
      copyDirSafe(src, path.join(dstRules, stack))
      info(`  .eagle/rules/${stack}/ 已复制`)
    } else {
      warn(`  规范目录不存在：${src}`)
    }
  }
}

function copyComponents() {
  const src = path.join(FRAMEWORK_DIR, '.eagle', 'components')
  if (fs.existsSync(src)) {
    copyDirSafe(src, path.join(TARGET_DIR, '.eagle', 'components'))
    ok('组件蓝图已复制')
  }
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
      '.eagle/knowledge/', '.eagle/memory/', '.eagle/tasks/', '',
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
