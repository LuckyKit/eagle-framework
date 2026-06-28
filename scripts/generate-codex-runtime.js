#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CLAUDE_ROOT = path.join(ROOT, 'plugin', 'claude')
const CODEX_ROOT = path.join(ROOT, 'plugin', 'codex')
const CLAUDE_SKILLS = path.join(CLAUDE_ROOT, 'skills')
const CLAUDE_AGENTS = path.join(CLAUDE_ROOT, 'agents')
const CODEX_SKILLS = path.join(CODEX_ROOT, 'skills')
const CODEX_AGENTS = path.join(CODEX_ROOT, 'agents')

function mkdirSafe(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
}

function writeText(filePath, content) {
  mkdirSafe(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function removeGenerated(dir, shouldRemove) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (shouldRemove(entry)) {
      fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true })
    }
  }
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return
  fs.cpSync(src, dst, { recursive: true })
}

function yamlQuote(value) {
  return JSON.stringify(value)
}

function tomlLiteral(value) {
  return "'''\n" + value.replace(/'''/g, '[triple-single-quote]') + "\n'''"
}

function stripFrontmatter(content) {
  content = content.replace(/^\uFEFF/, '')
  if (!content.startsWith('---')) return { meta: {}, body: content }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!m) continue
    meta[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }

  return { meta, body: match[2].replace(/^\uFEFF/, '') }
}

function firstHeading(content) {
  const line = content.split(/\r?\n/).find(l => l.startsWith('# ')) || ''
  return line.replace(/^#\s*/, '').trim()
}

function firstBlockquote(content) {
  const line = content.split(/\r?\n/).find(l => l.startsWith('> ')) || ''
  return line.replace(/^>\s*/, '').trim()
}

function syncSkills() {
  mkdirSafe(CODEX_SKILLS)
  removeGenerated(CODEX_SKILLS, entry => entry.isDirectory() && entry.name.startsWith('eagle-'))

  let count = 0
  for (const entry of fs.readdirSync(CLAUDE_SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const sourceDir = path.join(CLAUDE_SKILLS, entry.name)
    const sourceSkill = path.join(sourceDir, 'SKILL.md')
    if (!fs.existsSync(sourceSkill)) continue

    const skillName = `eagle-${entry.name}`
    const targetDir = path.join(CODEX_SKILLS, skillName)
    const sourceBody = readText(sourceSkill)
    const heading = firstHeading(sourceBody).replace(/^\/eagle:/, 'eagle ')
    const summary = firstBlockquote(sourceBody)
    const description = summary || `${heading || skillName}. Use when working with Eagle Framework project workflows.`

    const skillContent = [
      '---',
      `name: ${skillName}`,
      `description: ${yamlQuote(`${description} Use this Codex skill when the user asks for the matching Eagle workflow or explicitly invokes $${skillName}.`)}`,
      '---',
      '',
      `# ${skillName}`,
      '',
      '<!-- Generated from plugin/claude. Run `npm run sync:codex` after editing Claude skills. -->',
      '',
      `Codex invocation: \`$${skillName}\`. Legacy Claude slash-command examples are preserved below for workflow compatibility.`,
      '',
      sourceBody,
    ].join('\n')
    writeText(path.join(targetDir, 'SKILL.md'), skillContent)

    const referencesDir = path.join(sourceDir, 'references')
    if (fs.existsSync(referencesDir)) {
      copyDir(referencesDir, path.join(targetDir, 'references'))
    }

    const openaiYaml = [
      'interface:',
      `  display_name: ${yamlQuote(heading || skillName)}`,
      `  short_description: ${yamlQuote(description.slice(0, 120))}`,
      `  default_prompt: ${yamlQuote(`Use $${skillName} to run the matching Eagle workflow.`)}`,
      '',
    ].join('\n')
    writeText(path.join(targetDir, 'agents', 'openai.yaml'), openaiYaml)
    count++
  }
  return count
}

function syncAgents() {
  mkdirSafe(CODEX_AGENTS)
  removeGenerated(CODEX_AGENTS, entry => (
    entry.isFile() && entry.name.startsWith('eagle-') && entry.name.endsWith('.toml')
  ))

  let count = 0
  for (const entry of fs.readdirSync(CLAUDE_AGENTS, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const sourcePath = path.join(CLAUDE_AGENTS, entry.name)
    const { meta, body } = stripFrontmatter(readText(sourcePath))
    const fallbackName = `eagle-${path.basename(entry.name, '.md')}`
    const name = meta.name || fallbackName
    const description = meta.description || `${name} custom agent for Eagle Framework.`

    const content = [
      `name = ${JSON.stringify(name)}`,
      `description = ${JSON.stringify(description)}`,
      '# Generated from plugin/claude. Run `npm run sync:codex` after editing Claude agents.',
      `developer_instructions = ${tomlLiteral(body.trim())}`,
      '',
    ].join('\n')
    writeText(path.join(CODEX_AGENTS, `${name}.toml`), content)
    count++
  }
  return count
}

function main() {
  if (!fs.existsSync(CLAUDE_SKILLS)) throw new Error(`Missing Claude skills source: ${CLAUDE_SKILLS}`)
  if (!fs.existsSync(CLAUDE_AGENTS)) throw new Error(`Missing Claude agents source: ${CLAUDE_AGENTS}`)

  const skillCount = syncSkills()
  const agentCount = syncAgents()
  console.log(`Synced Codex runtime: ${skillCount} skills, ${agentCount} agents`)
}

main()
