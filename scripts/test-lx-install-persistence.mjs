import { readFileSync } from 'node:fs'

const musicAppPath = 'whymusic-source/packages/web/src/musicApp.ts'
const runnerPath = 'whymusic-source/packages/web/src/core/plugin/runner.ts'
const lxPath = 'whymusic-source/packages/web/src/core/plugin/lxCompat.ts'

const musicApp = readFileSync(musicAppPath, 'utf8')
const runner = readFileSync(runnerPath, 'utf8')
const lxCompat = readFileSync(lxPath, 'utf8')

const checks = [
  ['fetch → validate', 'const isCommonJSPlugin = code.includes', musicApp],
  ['LX validation', 'const isLXMusicSource = /(?:globalThis|window)\\.lx/.test(code)', musicApp],
  ['validate → load', 'loadPluginCode(code, pluginName.trim() || undefined)', musicApp],
  ['load → persist', 'savePluginCode(registered, code)', musicApp],
  ['runner LX branch', 'buildLXPlugin(code, { pluginFetch, requireFn: _require, console: _console })', runner],
  ['LX loader implementation', 'export function buildLXPlugin(code: string, deps: LXCompatDeps)', lxCompat],
]

for (const [name, needle, source] of checks) {
  if (!source.includes(needle)) throw new Error('Missing installed LX contract: ' + name)
  console.log('✓ ' + name)
}

if (!runner.includes("from './lxCompat'")) {
  throw new Error('PluginRunner is not importing the LX compatibility layer')
}

console.log('✓ LX install persistence contract is present in generated WhyMusic sources')
