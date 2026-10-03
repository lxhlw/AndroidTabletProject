import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const patch = readFileSync('scripts/patch-lx-compat.mjs', 'utf8')

if (!patch.includes('const code = await fetchPluginCode(url, true)')) {
  throw new Error('LX installer patch no longer hooks installPluginFromURL code fetch')
}
if (!patch.includes('loadPluginCode(code, pluginName.trim() || undefined)')) {
  throw new Error('LX installer patch no longer loads fetched source through PluginRunner')
}
if (!patch.includes('savePluginCode(registered, code)')) {
  throw new Error('LX installer patch no longer persists installed source code')
}
if (!patch.includes('isLXMusicSource')) {
  throw new Error('LX installer validation is missing')
}
if (!patch.includes('buildLXPlugin(code, {')) {
  throw new Error('LX runtime loader hook is missing')
}

const checks = [
  ['fetch → validate', "const isLXMusicSource = /(?:globalThis|window)\\.lx/.test(code)"],
  ['validate → load', 'loadPluginCode(code, pluginName.trim() || undefined)'],
  ['load → persist', 'savePluginCode(registered, code)'],
  ['reload → runtime', "buildLXPlugin(code, { pluginFetch, requireFn: _require, console: _console })"],
]
for (const [name, needle] of checks) {
  if (!patch.includes(needle)) throw new Error('Missing installer persistence contract: ' + name)
  console.log('✓ ' + name)
}

console.log('✓ LX install persistence contract is present in the build patch')
