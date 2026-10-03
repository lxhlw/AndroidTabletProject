import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const baseUrl = process.env.BASE_URL || 'https://whymusic-l101.pages.dev'
const sourceUrl = 'https://raw.githubusercontent.com/cdyUuu/lx-music-xinghai-source/main/xinghai-music-source.js'
const tsPath = process.env.WHYMUSIC_TYPESCRIPT
if (!tsPath) throw new Error('WHYMUSIC_TYPESCRIPT is not set')

const installUrl = baseUrl + '/api/proxy?url=' + encodeURIComponent(sourceUrl) + '&method=GET'
const response = await fetch(installUrl, { cache: 'no-store' })
if (!response.ok) throw new Error('Production installer fetch failed: HTTP ' + response.status)

const code = await response.text()
if (!/(?:globalThis|window)\.lx/.test(code)) throw new Error('Installer response is not LX source code')
if (!/EVENT_NAMES\.inited/.test(code)) throw new Error('Installer response is missing LX init protocol')
if (/module\.exports\s*=/.test(code)) throw new Error('LX source was unexpectedly transformed into CommonJS')

console.log('✓ Production installer fetch returned valid LX source code')

const lxUrlResponse = await fetch(baseUrl + '/api/lx-url?source=qq&id=97773&br=128', { cache: 'no-store' })
if (!lxUrlResponse.ok) {
  throw new Error('Production /api/lx-url failed: HTTP ' + lxUrlResponse.status + ' ' + (await lxUrlResponse.text()).slice(0, 300))
}
const lxUrlBody = await lxUrlResponse.json()
if (typeof lxUrlBody?.url !== 'string' || !/^https?:\/\//.test(lxUrlBody.url)) {
  throw new Error('Production /api/lx-url returned no playable URL')
}
console.log('✓ Production /api/lx-url returned a playable QQ URL')


const tsModule = await import(pathToFileURL(tsPath).href)
const tsCompiler = tsModule.default || tsModule
const lxTsPath = 'whymusic-source/packages/web/src/core/plugin/lxCompat.ts'
let tsSource = readFileSync(lxTsPath, 'utf8')
tsSource = tsSource.replace("import { Plugin } from '../types'\\n", '')

const transpiled = tsCompiler.transpileModule(tsSource, {
  compilerOptions: {
    target: tsCompiler.ScriptTarget.ES2022,
    module: tsCompiler.ModuleKind.ESNext,
    moduleResolution: tsCompiler.ModuleResolutionKind.Bundler,
    removeComments: false,
  },
}).outputText

const tempPath = join(tmpdir(), 'lxCompat-installer-contract.mjs')
writeFileSync(tempPath, transpiled, 'utf8')
const { buildLXPlugin } = await import(pathToFileURL(tempPath).href)
unlinkSync(tempPath)

const fakeConsole = { log() {}, warn() {}, info() {}, error() {} }
let proxyCalls = 0
const pluginFetch = async (input, init = {}) => {
  const url = String(input)
  if (url.startsWith(baseUrl + '/api/proxy?')) proxyCalls++
  return new Response(JSON.stringify({ code: 200, url: 'https://example.com/fake-audio.mp3' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const plugin = buildLXPlugin(code, {
  pluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

const media = await plugin.getMediaSource({
  id: 'wy-installer-test',
  title: 'Installer Test',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: { id: 'wy-installer-test', songmid: 'wy-installer-test', name: 'Installer Test', singer: 'Test Artist' },
  lxAlternatives: [],
}, '128')

if (!media?.url || media.source !== 'wy') throw new Error('Installed LX source could not be loaded into runtime')
if (proxyCalls < 1) throw new Error('Loaded LX source did not exercise the WhyMusic proxy')

console.log('✓ Production-fetched LX source loaded through buildLXPlugin')
console.log('✓ Production-fetched LX source executed musicUrl successfully')
console.log('✓ LX install contract passed: fetch → validate → load → execute')
