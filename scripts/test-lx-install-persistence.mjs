import { readFileSync } from 'node:fs'

const musicAppPath = 'whymusic-source/packages/web/src/musicApp.ts'
const runnerPath = 'whymusic-source/packages/web/src/core/plugin/runner.ts'
const lxPath = 'whymusic-source/packages/web/src/core/plugin/lxCompat.ts'
const typesPath = 'whymusic-source/packages/web/src/core/types.ts'
const managerPath = 'whymusic-source/packages/web/src/core/plugin/manager.ts'

const musicApp = readFileSync(musicAppPath, 'utf8')
const runner = readFileSync(runnerPath, 'utf8')
const lxCompat = readFileSync(lxPath, 'utf8')
const types = readFileSync(typesPath, 'utf8')
const manager = readFileSync(managerPath, 'utf8')

const checks = [
  ['fetch → validate', 'const isCommonJSPlugin =', musicApp],
  ['LX validation', 'const hasLXNamespace =', musicApp],
  ['validate → load', 'loadPluginCode(code, pluginName.trim() || undefined)', musicApp],
  ['load → persist', 'savePluginCode(registered, code)', musicApp],
  ['runner LX branch', 'buildLXPlugin(code, { pluginFetch, requireFn: _require, console: _console })', runner],
  ['LX loader implementation', 'export function buildLXPlugin(code: string, deps: LXCompatDeps)', lxCompat],
  ['Plugin artwork interface', 'getArtwork?(item: MusicItem): Promise<any>', types],
  ['Manager artwork bridge', 'async getArtwork(plugin: Plugin, item: MusicItem): Promise<string>', manager],
  ['Lazy LX artwork lookup', 'typeof pluginManager.getArtwork === \'function\'', musicApp],
  ['Artwork lookup only when missing', 'if (!metadataItem.artwork &&', musicApp],
  ['Artwork failure does not stop playback', 'catch {', musicApp],
  ['Metadata uses resolved artwork', 'applyMediaMetadata(metadataItem)', musicApp],
]

for (const [name, needle, source] of checks) {
  if (!source.includes(needle)) throw new Error('Missing installed LX contract: ' + name)
  console.log('✓ ' + name)
}

if (!runner.includes("from './lxCompat'")) {
  throw new Error('PluginRunner is not importing the LX compatibility layer')
}

console.log('✓ LX install persistence contract is present in generated WhyMusic sources')
