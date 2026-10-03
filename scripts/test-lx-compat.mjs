import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const tsPath = process.env.WHYMUSIC_TYPESCRIPT
if (!tsPath) throw new Error('WHYMUSIC_TYPESCRIPT is not set')
const tsModule = await import(pathToFileURL(tsPath).href)
const tsCompiler = tsModule.default || tsModule

const sourceUrl = 'https://raw.githubusercontent.com/cdyUuu/lx-music-xinghai-source/main/xinghai-music-source.js'
const sourceCode = await (await fetch(sourceUrl)).text()

if (!sourceCode.includes('globalThis.lx')) throw new Error('LX sample missing globalThis.lx')
if (!sourceCode.includes('EVENT_NAMES.inited')) throw new Error('LX sample missing EVENT_NAMES.inited')
for (const key of ['wy', 'tx', 'kg', 'kw', 'mg']) {
  if (!sourceCode.includes(key)) {
    throw new Error('LX sample missing platform ' + key)
  }
}

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

const tempPath = join(tmpdir(), 'lxCompat-smoke.mjs')
writeFileSync(tempPath, transpiled, 'utf8')

const { buildLXPlugin } = await import(pathToFileURL(tempPath).href)
unlinkSync(tempPath)

const requests = []
const fakeConsole = {
  log() {},
  warn() {},
  info() {},
  error() {},
}

const fakeResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

const pluginFetch = async (input, init = {}) => {
  const url = String(input)
  requests.push({ url, method: init?.method || 'GET' })

  if (url.startsWith('https://whymusic-l101.pages.dev/api/proxy?')) {
    return fakeResponse({
      code: 200,
      ip: '127.0.0.1',
      url: 'https://example.com/fake-audio.mp3',
      lrc: '[00:00.00] LX compatibility smoke test',
    })
  }

  return fakeResponse({ code: 200, url: 'https://example.com/fake-audio.mp3' })
}

const plugin = buildLXPlugin(sourceCode, {
  pluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

const cases = [
  { source: 'wy', id: 'wy-id-1', info: { id: 'wy-id-1', songmid: 'wy-id-1', name: 'Smoke Test', singer: 'Test Artist' } },
  { source: 'tx', id: 'tx-mid-1', info: { songmid: 'tx-mid-1', strMediaMid: 'tx-media-1', name: 'Smoke Test', singer: 'Test Artist' } },
  { source: 'kg', id: 'kg-hash-1', info: { hash: 'kg-hash-1', songmid: 'kg-hash-1', albumId: 'kg-album-1', name: 'Smoke Test', singer: 'Test Artist' } },
  { source: 'kw', id: 'kw-mid-1', info: { songmid: 'kw-mid-1', name: 'Smoke Test', singer: 'Test Artist' } },
  { source: 'mg', id: 'mg-id-1', info: { songmid: 'mg-id-1', name: 'Smoke Test', singer: 'Test Artist' } },
]

console.log('✓ Real LX source parsed and initialized')

for (const item of cases) {
  const result = await plugin.getMediaSource({
    id: item.id,
    title: 'Smoke Test',
    artist: 'Test Artist',
    subSource: item.source,
    lxInfo: item.info,
    lxAlternatives: [],
  }, '128')

  if (!result?.url || result.source !== item.source) {
    throw new Error('LX playback bridge failed for ' + item.source)
  }
  console.log('✓ LX musicUrl handler works: ' + item.source)
}

if (!requests.some(r => r.url.includes('/api/proxy?'))) {
  throw new Error('LX request bridge was never exercised')
}

const lyric = await plugin.getLyric({
  id: 'wy-id-1',
  title: 'Smoke Test',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: { id: 'wy-id-1', songmid: 'wy-id-1', name: 'Smoke Test', singer: 'Test Artist' },
})

if (!lyric || typeof lyric.rawLrc !== 'string') {
  throw new Error('LX lyric bridge returned an invalid payload')
}

console.log('✓ LX request() bridge reached the WhyMusic proxy')
console.log('✓ LX playback works for wy / tx / kg / kw / mg')
console.log('✓ LX lyric handler bridge works')

const fallbackPluginFetch = async (input, init = {}) => {
  const url = String(input)
  if (url.startsWith('https://whymusic-l101.pages.dev/api/proxy?')) {
    const target = decodeURIComponent(new URL(url).searchParams.get('url') || '')
    if (target.includes('interface3.music.163.com') || target.includes('music-api.gdstudio.xyz') || target.includes('/eapi/')) {
      throw new Error('simulated primary wy failure')
    }
    return fakeResponse({ code: 200, url: 'https://example.com/fallback-audio.mp3' })
  }
  return fakeResponse({ code: 200, url: 'https://example.com/fake-audio.mp3' })
}

const fallbackPlugin = buildLXPlugin(sourceCode, {
  pluginFetch: fallbackPluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

const fallbackResult = await fallbackPlugin.getMediaSource({
  id: 'wy-fail',
  title: 'Fallback Test',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: { id: 'wy-fail', songmid: 'wy-fail', name: 'Fallback Test', singer: 'Test Artist' },
  lxAlternatives: [
    { id: 'tx-ok', source: 'tx', lxInfo: { songmid: 'tx-ok', strMediaMid: 'tx-media-ok', name: 'Fallback Test', singer: 'Test Artist' } },
  ],
}, '128')

if (!fallbackResult?.url || fallbackResult.source !== 'tx') {
  throw new Error('LX automatic fallback from wy to tx failed')
}

console.log('✓ LX automatic fallback switches from failed wy to tx')

const searchPluginFetch = async (input, init = {}) => {
  const url = String(input)
  if (!url.includes('/api/lx-search')) return fakeResponse({ code: 200 })
  const source = new URL(url).searchParams.get('source')
  if (source === 'qq') {
    return fakeResponse({
      data: [
        { id: 'tx-1', title: '晴天', name: '晴天', artist: '周杰伦', singer: '周杰伦', album: '叶惠美', albumName: '叶惠美', songmid: 'tx-1' },
      ],
    })
  }
  throw new Error('simulated source unavailable: ' + source)
}

const searchPlugin = buildLXPlugin(sourceCode, {
  pluginFetch: searchPluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

const searchResult = await searchPlugin.search('周杰伦', 1, 'music')
if (!Array.isArray(searchResult?.data) || searchResult.data.length < 1) {
  throw new Error('LX search aggregation dropped the successful QQ source')
}
if (searchResult.data[0].subSource !== 'tx') {
  throw new Error('LX search aggregation returned the wrong primary source')
}

console.log('✓ LX search aggregation keeps successful sources when others fail')
