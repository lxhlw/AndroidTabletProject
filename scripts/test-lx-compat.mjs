import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'node:module'

const tsModule = await import('typescript')
const tsCompiler = tsModule.default || tsModule

const sourceUrl = 'https://raw.githubusercontent.com/cdyUuu/lx-music-xinghai-source/main/xinghai-music-source.js'
const sourceCode = await (await fetch(sourceUrl)).text()

if (!sourceCode.includes('globalThis.lx')) throw new Error('LX sample missing globalThis.lx')
if (!sourceCode.includes('EVENT_NAMES.inited')) throw new Error('LX sample missing EVENT_NAMES.inited')
for (const key of ['wy', 'tx', 'kg', 'kw', 'mg']) {
  if (!new RegExp('\\\\b' + key + '\\\\b').test(sourceCode)) {
    throw new Error('LX sample missing platform ' + key)
  }
}

const lxTsPath = 'packages/web/src/core/plugin/lxCompat.ts'
let tsSource = readFileSync(lxTsPath, 'utf8')
tsSource = tsSource.replace("import { Plugin } from '../types'\\n", '')

const transpiled = tsCompiler.transpileModule(tsSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
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

const result = await plugin.getMediaSource({
  id: '123456',
  title: 'Smoke Test',
  artist: 'Test Artist',
  subSource: 'wy',
  lxInfo: { id: '123456', songmid: '123456', name: 'Smoke Test', singer: 'Test Artist' },
  lxAlternatives: [
    { id: 'qq-mid-1', source: 'tx', lxInfo: { songmid: 'qq-mid-1', name: 'Smoke Test', singer: 'Test Artist' } },
    { id: 'kg-hash-1', source: 'kg', lxInfo: { hash: 'kg-hash-1', name: 'Smoke Test', singer: 'Test Artist' } },
    { id: 'kw-mid-1', source: 'kw', lxInfo: { songmid: 'kw-mid-1', name: 'Smoke Test', singer: 'Test Artist' } },
    { id: 'mg-id-1', source: 'mg', lxInfo: { songmid: 'mg-id-1', name: 'Smoke Test', singer: 'Test Artist' } },
  ],
}, '128')

if (!result?.url || result.source !== 'wy') throw new Error('LX playback bridge did not return the primary source URL')
if (!requests.some(r => r.url.includes('/api/proxy?'))) throw new Error('LX request bridge was never exercised')

console.log('✓ Real LX source parsed and initialized')
console.log('✓ LX getMediaSource executed the real musicUrl handler')
console.log('✓ LX request() bridge reached the WhyMusic proxy')
console.log('✓ Primary LX source wy returned a playable URL')
