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
const validationStart = musicApp.indexOf("  // 代理把上游錯誤也當內容回傳");
const validationEnd = musicApp.indexOf("  return code", validationStart);
if (validationStart < 0 || validationEnd < 0) throw new Error('LX patch: plugin validation markers not found');
const validationBlock = [
  "  // 代理把上游錯誤也當內容回傳，這裡確認真的是插件碼而不是錯誤頁",
  "  const isCommonJSPlugin = code.includes('module.exports') || code.includes('exports.')",
  "  const isLXMusicSource = /(?:globalThis|window)\\.lx/.test(code)",
  "    && /EVENT_NAMES\\.inited/.test(code)",
  "  if (!isCommonJSPlugin && !isLXMusicSource) {",
  "    throw new Error(t('回應不是插件代碼（可能是上游錯誤頁）'))",
  "  }",
].join('\\n') + "\n";
musicApp = musicApp.slice(0, validationStart) + validationBlock + musicApp.slice(validationEnd);
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
    'function lxArtistNames(value) {',
    "  if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v : (v?.name || v?.singerName || '')).filter(Boolean).join(' / ')",
    "  return String(value || '')",
    '}',
    '',
    'function lxNormalizeSearchItem(source, raw) {',
    '  if (!raw || typeof raw !== "object") return null',
    '  if (source === "wy" || source === "netease") {',
    '    const title = String(raw.name || raw.songName || raw.title || "")',
    '    const artist = lxArtistNames(raw.ar || raw.artists || raw.singer || raw.singers)',
    '    const id = raw.id ?? raw.songId',
    '    if (!id || !title) return null',
    '    const album = raw.al || raw.album || {}',
    '    return { id: String(id), name: title, title, singer: artist, artist, albumName: String(album.name || raw.albumname || ""), album: String(album.name || raw.albumname || ""), songmid: String(id), picId: String(album.pic_str || album.pic || ""), duration: Number(raw.dt || raw.duration || raw.interval || 0) || 0 }',
    '  }',
    '  if (source === "tx" || source === "qq") {',
    '    const title = String(raw.songname || raw.songName || raw.name || raw.title || "")',
    '    const artist = lxArtistNames(raw.singer || raw.singers || raw.artist || raw.artists)',
    '    const id = raw.songmid || raw.songMid || raw.strMediaMid || raw.songid || raw.id',
    '    if (!id || !title) return null',
    '    return { ...raw, id: String(id), songmid: String(raw.songmid || raw.songMid || id), strMediaMid: String(raw.strMediaMid || raw.songmid || raw.songMid || ""), name: title, title, singer: artist, artist, albumName: String(raw.albumname || raw.albumName || ""), album: String(raw.albumname || raw.albumName || ""), duration: Number(raw.interval || raw.duration || 0) || 0 }',
    '  }',
    '  if (source === "kg" || source === "kugou") {',
    '    const title = String(raw.songname || raw.songName || raw.name || "")',
    '    const artist = String(raw.singername || raw.singerName || raw.artist || raw.singer || "")',
    '    const id = raw.hash || raw.audio_id || raw.songmid || raw.song_id || raw.id',
    '    if (!id || !title) return null',
    '    return { ...raw, id: String(id), hash: String(raw.hash || id), songmid: String(raw.songmid || id), name: title, title, singer: artist, artist, albumName: String(raw.album_name || raw.albumName || raw.album || ""), album: String(raw.album_name || raw.albumName || raw.album || ""), duration: Number(raw.duration || 0) || 0 }',
    '  }',
    '  if (source === "kw" || source === "kuwo") {',
    '    const rid = String(raw.MUSICRID || raw.musicrid || raw.musicRid || raw.id || "")',
    '    const id = rid.replace(/^MUSIC_/i, "")',
    '    const title = String(raw.SONGNAME || raw.songName || raw.name || raw.title || "")',
    '    const artist = String(raw.ARTIST || raw.artist || raw.singer || "")',
    '    if (!id || !title) return null',
    '    return { ...raw, id, songmid: id, name: title, title, singer: artist, artist, albumName: String(raw.ALBUM || raw.album || raw.albumName || ""), album: String(raw.ALBUM || raw.album || raw.albumName || ""), duration: Number(raw.DURATION || raw.duration || 0) || 0 }',
    '  }',
    '  if (source === "mg" || source === "migu") {',
    '    const title = String(raw.songName || raw.musicName || raw.name || raw.title || "")',
    '    const artist = String(raw.singerName || raw.singer || raw.artist || "")',
    '    const id = raw.copyrightId || raw.songId || raw.id',
    '    if (!id || !title) return null',
    '    return { ...raw, id: String(id), songmid: String(id), copyrightId: String(raw.copyrightId || id), name: title, title, singer: artist, artist, albumName: String(raw.albumName || raw.album || ""), album: String(raw.albumName || raw.album || ""), duration: Number(raw.length || raw.duration || 0) || 0 }',
    '  }',
    '  return null',
    '}',
    '',
    'async function lxDirectSearch(source, keyword, page = 1, count = 20) {',
    '  const p = Math.max(1, Number(page) || 1)',
    '  const n = Math.min(50, Math.max(1, Number(count) || 20))',
    '  const q = String(keyword || "").trim()',
    '  if (!q) return []',
    '  if (source === "wy" || source === "netease") {',
    '    const offset = (p - 1) * n',
    '    const data = await neteaseFetch("/api/search/get/web?s=" + encodeURIComponent(q) + "&type=1&limit=" + n + "&offset=" + offset)',
    '    return ((data?.result?.songs) || []).map(raw => lxNormalizeSearchItem("wy", raw)).filter(Boolean)',
    '  }',
    '  if (source === "tx" || source === "qq") {',
    '    const url = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&p=" + p + "&n=" + n + "&w=" + encodeURIComponent(q) + "&t=0&aggr=1&lossless=1&cr=1&catZhida=1"',
    '    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://y.qq.com/" } })',
    '    const data = await resp.json()',
    '    return ((data?.data?.song?.list) || []).map(raw => lxNormalizeSearchItem("tx", raw)).filter(Boolean)',
    '  }',
    '  if (source === "kg" || source === "kugou") {',
    '    const url = "https://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=" + encodeURIComponent(q) + "&page=" + p + "&pagesize=" + n + "&showtype=1"',
    '    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })',
    '    const data = await resp.json()',
    '    return ((data?.data?.info) || []).map(raw => lxNormalizeSearchItem("kg", raw)).filter(Boolean)',
    '  }',
    '  if (source === "kw" || source === "kuwo") {',
    '    const url = "https://search.kuwo.cn/api/www/search/searchMusicBykeyWord?all=" + encodeURIComponent(q) + "&pn=" + (p - 1) + "&rn=" + n + "&rformat=json&encoding=utf8&mobi=1&show_copyright_off=1"',
    '    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://kuwo.cn/" } })',
    '    const data = await resp.json()',
    '    return ((data?.abslist) || (data?.data?.musicList) || []).map(raw => lxNormalizeSearchItem("kw", raw)).filter(Boolean)',
    '  }',
    '  if (source === "mg" || source === "migu") {',
    '    const url = "https://m.music.migu.cn/migu/remoting/scr_search_tag?keyword=" + encodeURIComponent(q) + "&type=2&rows=" + n + "&pgc=" + p',
    '    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://m.music.migu.cn/" } })',
    '    const data = await resp.json()',
    '    const list = data?.musics || data?.musicList || data?.data?.musics || data?.data?.musicList || []',
    '    return (Array.isArray(list) ? list : []).map(raw => lxNormalizeSearchItem("mg", raw)).filter(Boolean)',
    '  }',
    '  throw new Error("Unsupported LX source: " + source)',
    '}',
    '',
    'async function searchWhyMusicPlatform(source, keyword, page = 1, count = 20) {',
    '  return lxDirectSearch(source, keyword, page, count)',
    '}'
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
