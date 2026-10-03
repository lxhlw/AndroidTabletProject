import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const runnerPath = 'packages/web/src/core/plugin/runner.ts'
const musicAppPath = 'packages/web/src/musicApp.ts'
const whyPath = 'packages/web/worker/why.js'
const indexPath = 'packages/web/worker/index.js'
const overridePath = '../overrides/lxCompat.ts'
const targetOverridePath = 'packages/web/src/core/plugin/lxCompat.ts'

function replaceOnce(text, pattern, replacement, label) {
  const match = text.match(pattern)
  if (!match) throw new Error('LX patch: missing ' + label)
  return text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length)
}

copyFileSync(overridePath, targetOverridePath)

// PluginRunner: import and detect LX source before CommonJS evaluation.
let runner = readFileSync(runnerPath, 'utf8')
if (!runner.includes("from './lxCompat'")) {
  runner = runner.replace(
    "import { Plugin } from '../types'\n",
    "import { Plugin } from '../types'\nimport { buildLXPlugin, isLXMusicSourceCode } from './lxCompat'\n",
  )
}
if (!runner.includes('buildLXPlugin(code, {')) {
  runner = runner.replace(
    "  static load(code: string): Plugin {\n",
    "  static load(code: string): Plugin {\n    if (isLXMusicSourceCode(code)) {\n      return buildLXPlugin(code, { pluginFetch, requireFn: _require, console: _console })\n    }\n\n",
  )
}
writeFileSync(runnerPath, runner)

// Allow LX source code through the URL installer validation.
let musicApp = readFileSync(musicAppPath, 'utf8')
musicApp = replaceOnce(
  musicApp,
  /if \(!code\.includes\('module\.exports'\) && !code\.includes\('exports\\.'\)\) \{[\s\S]*?\n  \}/,
  "const isCommonJSPlugin = code.includes('module.exports') || code.includes('exports.')\n"
  + "  const isLXMusicSource = /(?:globalThis|window)\\.lx/.test(code)\n"
  + "    && /EVENT_NAMES\\.inited/.test(code)\n"
  + "  if (!isCommonJSPlugin && !isLXMusicSource) {\n"
  + "    throw new Error(t('回應不是插件代碼（可能是上游錯誤頁）'))\n"
  + "  }",
  'plugin source validation',
)
writeFileSync(musicAppPath, musicApp)

// Worker helper: search one GD platform on behalf of LX-compatible plugins.
let why = readFileSync(whyPath, 'utf8')
if (!why.includes('async function searchWhyMusicPlatform(')) {
  const marker = '\n/** 取單一子源的搜尋結果：'
  const at = why.indexOf(marker)
  if (at < 0) throw new Error('LX patch: why search marker not found')
  const helper = [
    '',
    'const LX_GD_SOURCE_MAP = {',
    "  wy: 'netease',",
    "  tx: 'qq',",
    "  kg: 'kugou',",
    "  kw: 'kuwo',",
    "  mg: 'migu',",
    '}',
    '',
    'async function searchWhyMusicPlatform(source, keyword, page = 1, count = 20) {',
    '  const gdSource = LX_GD_SOURCE_MAP[source] || source',
    "  const data = await gdRequest('search', {",
    '    source: gdSource,',
    '    name: keyword,',
    '    count: String(Math.min(50, Math.max(1, Number(count) || 20))),',
    '    pages: String(Math.max(1, Number(page) || 1)),',
    '  })',
    '  return Array.isArray(data) ? data : []',
    '}',
  ].join('\n')
  why = why.slice(0, at) + helper + why.slice(at)
}
if (!why.includes('  searchWhyMusicPlatform,\n')) {
  why = why.replace('  recommendWhyMusic,\n', '  recommendWhyMusic,\n  searchWhyMusicPlatform,\n')
}
writeFileSync(whyPath, why)

// Worker route for LX search.
let index = readFileSync(indexPath, 'utf8')
if (!index.includes("case '/api/lx-search':")) {
  if (!index.includes('  searchWhyMusicPlatform,\n')) {
    index = index.replace('  searchWhyMusic,\n', '  searchWhyMusic,\n  searchWhyMusicPlatform,\n')
  }

  const marker = "    case '/api/why-search': {"
  const at = index.indexOf(marker)
  if (at < 0) throw new Error('LX patch: why-search route marker not found')

  const route = [
    "    case '/api/lx-search': {",
    "      const source = url.searchParams.get('source') || ''",
    "      const keyword = url.searchParams.get('q') || ''",
    "      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)",
    "      const count = Math.min(50, Math.max(1, parseInt(url.searchParams.get('count') || '20', 10) || 20))",
    "      if (!source) return jsonResponse({ error: 'Missing source parameter' }, 400)",
    "      if (!keyword) return jsonResponse({ error: 'Missing q parameter' }, 400)",
    "      if (!/^(wy|tx|kg|kw|mg|netease|qq|kugou|kuwo|migu)$/.test(source)) {",
    "        return jsonResponse({ error: 'Unsupported LX source: ' + source }, 400)",
    "      }",
    "      return jsonResponse({",
    "        data: await searchWhyMusicPlatform(source, keyword, page, count),",
    "      })",
    "    }",
    "",
  ].join('\n')

  index = index.slice(0, at) + route + index.slice(at)
}
writeFileSync(indexPath, index)

console.log('✓ LX Music compatibility layer patched')
