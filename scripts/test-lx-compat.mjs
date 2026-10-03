import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const tsPath = process.env.WHYMUSIC_TYPESCRIPT
if (!tsPath) throw new Error('WHYMUSIC_TYPESCRIPT is not set')
const tsModule = await import(pathToFileURL(tsPath).href)
const tsCompiler = tsModule.default || tsModule

const sourceUrls = [
  'https://raw.githubusercontent.com/cdyUuu/lx-music-xinghai-source/main/xinghai-music-source.js',
  'https://raw.githubusercontent.com/wangxanshen/lx-music-source/main/gdstudio-source.js',
]
const sourceCodes = await Promise.all(sourceUrls.map(async (sourceUrl) => (await fetch(sourceUrl)).text()))
const sourceCode = sourceCodes[0]
const gdstudioCode = sourceCodes[1]
const sixyinUrl = 'https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js'
const sixyinCode = await (await fetch(sixyinUrl)).text()

for (const [label, code] of [['xinghai', sourceCode], ['gdstudio', gdstudioCode]]) {
  if (!/(?:globalThis|window)\.lx/.test(code)) throw new Error('LX sample missing globalThis.lx: ' + label)
  if (/EVENT_NAMES\.inited/.test(code) === false) throw new Error('LX sample missing EVENT_NAMES.inited: ' + label)
}
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

const { buildLXPlugin, isLXMusicSourceCode } = await import(pathToFileURL(tempPath).href)

const detectorCases = [
  ['dot notation', "globalThis.lx.EVENT_NAMES.inited", true],
  ['bracket notation', "globalThis['lx'].EVENT_NAMES['inited']", true],
  ['ordinary CommonJS', "module.exports = { name: 'Normal Plugin', platform: 'normal' }", false],
  ['plain JavaScript with lx text but no init', "globalThis.lx = {}; console.log('inited')", false],
  ['explicit CommonJS plus LX markers', "globalThis.lx; EVENT_NAMES.inited; module.exports = {}", false],
]
for (const [label, code, expected] of detectorCases) {
  const actual = isLXMusicSourceCode(code)
  if (actual !== expected) throw new Error('LX detector regression: ' + label + ' -> ' + actual)
  console.log('✓ LX detector: ' + label)
}

if (!isLXMusicSourceCode(sixyinCode)) throw new Error('LX detector rejected actual SixYin bundled source')
console.log('✓ LX detector: actual SixYin bundled source')

unlinkSync(tempPath)

const requests = []
const fakeConsole = {
  log(...args) { console.log('[SixYin]', ...args) },
  warn(...args) { console.log('[SixYin:warn]', ...args) },
  info(...args) { console.log('[SixYin:info]', ...args) },
  error(...args) { console.log('[SixYin:error]', ...args) },
  group() {},
  groupEnd() {},
}

const sixyinPluginFetch = async (input, init = {}) => {
  const url = String(input)
  const method = String(init?.method || 'GET').toUpperCase()
  requests.push({ url, method })
  console.log('[SixYin:request] ' + method + ' ' + url)
  if (url.startsWith('https://whymusic-l101.pages.dev/api/proxy?')) {
    const response = await fetch(url, {
      method,
      headers: init?.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : init?.body,
      cache: 'no-store',
    })
    const body = await response.text()
    if (url.includes('hibai.cn')) {
      console.log('[SixYin:proxy] hibai status=' + response.status + ' content-type=' + (response.headers.get('content-type') || ''))
      console.log('[SixYin:proxy] hibai body=' + body.slice(0, 1000))
    }
    if (!response.ok) {
      throw new Error('SixYin production proxy HTTP ' + response.status + ': ' + body.slice(0, 300))
    }
    return new Response(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    })
  }
  return fetch(input, init)
}

let sixyinPlugin
try {
  sixyinPlugin = buildLXPlugin(sixyinCode, {
    pluginFetch: sixyinPluginFetch,
    requireFn: (name) => { throw new Error('SixYin unexpected require: ' + name) },
    console: fakeConsole,
  })
} catch (err) {
  console.error('SIXYIN_LOAD_ERROR_NAME=' + (err?.name || 'unknown'))
  console.error('SIXYIN_LOAD_ERROR_MESSAGE=' + String(err?.message || err))
  console.error('SIXYIN_LOAD_ERROR_STACK=' + String(err?.stack || '').split('\n').slice(0, 4).join(' | '))
  throw err
}

let sixyinMedia
try {
  sixyinMedia = await sixyinPlugin.getMediaSource({
  id: '186016',
  title: 'SixYin Smoke Test',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: {
    id: 'sixyin-smoke-1',
    songmid: '186016',
    name: '晴天',
    singer: '周杰伦',
  },
  lxAlternatives: [],
}, '128')


} catch (err) {
  console.error('SIXYIN_EXEC_ERROR_NAME=' + (err?.name || 'unknown'))
  console.error('SIXYIN_EXEC_ERROR_MESSAGE=' + String(err?.message || err))
  console.error('SIXYIN_EXEC_ERROR_STACK=' + String(err?.stack || '').split('\n').slice(0, 5).join(' | '))
  throw err
}
if (!sixyinMedia?.url || sixyinMedia.source !== 'wy') {
  throw new Error('Actual SixYin source could not execute musicUrl through LX bridge')
}
if (!requests.some(r => r.url.includes('/api/proxy?'))) {
  throw new Error('Actual SixYin source did not exercise the WhyMusic proxy bridge')
}

console.log('✓ Actual SixYin bundled source loaded through buildLXPlugin')
console.log('✓ Actual SixYin musicUrl executed successfully through request bridge')

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
      picture: 'https://example.com/fake-cover.jpg',
      picUrl: 'https://example.com/fake-cover.jpg',
      cover: 'https://example.com/fake-cover.jpg',
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

await plugin.getMediaSource({
  id: 'tx-mid-1',
  title: 'Smoke Test',
  artist: 'Test Artist',
  subSource: 'tx',
  lxInfo: { songmid: 'tx-mid-1', strMediaMid: 'tx-media-1', name: 'Smoke Test', singer: 'Test Artist' },
  lxAlternatives: [],
}, '128')

const artwork = await plugin.getArtwork({
  id: 'tx-mid-1',
  title: 'Smoke Test',
  artist: 'Test Artist',
  subSource: 'tx',
  lxInfo: { songmid: 'tx-mid-1', strMediaMid: 'tx-media-1', name: 'Smoke Test', singer: 'Test Artist' },
})

if (!artwork || typeof artwork !== 'string' || artwork !== 'https://example.com/fake-cover.jpg') {
  throw new Error('LX pic bridge returned an invalid artwork URL')
}

console.log('✓ LX pic handler bridge works')
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

const gdRequests = []
const gdPluginFetch = async (input, init = {}) => {
  const url = String(input)
  gdRequests.push({ url, method: init?.method || 'GET' })
  if (url.startsWith('https://whymusic-l101.pages.dev/api/proxy?')) {
    const target = decodeURIComponent(new URL(url).searchParams.get('url') || '')
    if (target.includes('types=search')) {
      return fakeResponse([
        { id: 'gd-1', name: '晴天', artist: ['周杰伦'], source: 'netease', lyric_id: 'gd-1', pic_id: 'pic-1' },
      ])
    }
    if (target.includes('types=url')) {
      return fakeResponse({ url: 'https://example.com/gdstudio-audio.mp3' })
    }
  }
  return fakeResponse({ code: 200, url: 'https://example.com/gdstudio-audio.mp3' })
}

const gdPlugin = buildLXPlugin(gdstudioCode, {
  pluginFetch: gdPluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

console.log('✓ Second real LX source parsed and initialized: gdstudio')

const gdResult = await gdPlugin.getMediaSource({
  id: 'gd-song-1',
  title: '晴天',
  artist: '周杰伦',
  subSource: 'wy',
  lxInfo: { id: 'gd-song-1', songmid: 'gd-song-1', name: '晴天', singer: '周杰伦' },
  lxAlternatives: [],
}, '128')

if (!gdResult?.url || gdResult.source !== 'wy') {
  throw new Error('Second real LX source playback bridge failed')
}
if (!gdRequests.some(r => r.url.includes('/api/proxy?'))) {
  throw new Error('Second real LX source did not exercise the WhyMusic proxy')
}

console.log('✓ Second real LX source musicUrl handler works')

const minimalLX = `
/**
 * @name Minimal LX Source
 * @version 1.0.0
 */
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action !== 'musicUrl') throw new Error('unsupported action')
  return Promise.resolve('https://example.com/minimal-lx.mp3')
})
send(EVENT_NAMES.inited, {
  sources: {
    wy: { name: '网易', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
  },
})
`

const minimalPlugin = buildLXPlugin(minimalLX, {
  pluginFetch,
  requireFn: (name) => { throw new Error('unexpected require: ' + name) },
  console: fakeConsole,
})

const minimalResult = await minimalPlugin.getMediaSource({
  id: 'minimal-1',
  title: 'Minimal LX',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: { id: 'minimal-1', songmid: 'minimal-1', name: 'Minimal LX', singer: 'Test Artist' },
  lxAlternatives: [],
}, '128')

if (minimalResult?.url !== 'https://example.com/minimal-lx.mp3' || minimalResult.source !== 'wy') {
  throw new Error('Minimal official-style LX source failed musicUrl compatibility')
}
if (typeof minimalPlugin.getLyric !== 'function' || typeof minimalPlugin.getArtwork !== 'function') {
  throw new Error('LX runtime optional methods were not exposed')
}

console.log('✓ Minimal official-style LX source works with musicUrl-only protocol')
