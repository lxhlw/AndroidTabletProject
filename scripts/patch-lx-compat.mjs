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
const validationBlock = `  // 代理把上游錯誤也當內容回傳，這裡確認真的是插件碼而不是錯誤頁
  const isCommonJSPlugin = code.includes('module.exports') || code.includes('exports.')
  const hasLXNamespace =
    code.includes('globalThis.lx')
    || code.includes("globalThis['lx']")
    || code.includes('globalThis["lx"]')
    || code.includes('window.lx')
    || code.includes("window['lx']")
    || code.includes('window["lx"]')
  const hasLXInitEvent =
    code.includes('EVENT_NAMES.inited')
    || code.includes("EVENT_NAMES['inited']")
    || code.includes('EVENT_NAMES["inited"]')
  const isLXMusicSource = hasLXNamespace && hasLXInitEvent
  if (!isCommonJSPlugin && !isLXMusicSource) {
    throw new Error(t('回應不是插件代碼（可能是上游錯誤頁）'))
  }
`;
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
    'async function sha1Hex(text) {',
    '  const data = new TextEncoder().encode(text)',
    '  const digest = await crypto.subtle.digest("SHA-1", data)',
    '  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("")',
    '}',
    '',
    'function pickHashByIdx(hash, indexes) {',
    '  return indexes.map(idx => hash[idx]).join("")',
    '}',
    '',
    'function base64EncodeBytes(data) {',
    '  let binary = ""',
    '  for (const b of data) binary += String.fromCharCode(b)',
    '  return btoa(binary).replace(/[\\/+=]/g, "")',
    '}',
    '',
    'async function zzcSign(text) {',
    '  const hash = await sha1Hex(text)',
    '  const part1 = pickHashByIdx(hash, [23, 14, 6, 36, 16, 40, 7, 19])',
    '  const part2 = pickHashByIdx(hash, [16, 1, 32, 12, 19, 27, 8, 5])',
    '  const scramble = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]',
    '  const part3 = scramble.map((value, i) => value ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16))',
    '  const b64Part = base64EncodeBytes(part3)',
    '  return ("zzc" + part1 + b64Part + part2).toLowerCase()',
    '}',
    '',    'async function lxDirectSearch(source, keyword, page = 1, count = 20) {',
    '  const p = Math.max(1, Number(page) || 1)',
    '  const n = Math.min(50, Math.max(1, Number(count) || 20))',
    '  const q = String(keyword || "").trim()',
    '  if (!q) return []',
    '  if (source === "wy" || source === "netease") {',
    '    const offset = (p - 1) * n',
    '    const data = await searchWhyMusicNetease(q, p, n)',
    '    return (Array.isArray(data) ? data : []).map(raw => ({ id: raw.id, name: raw.title, title: raw.title, singer: raw.artist, artist: raw.artist, albumName: raw.album || "", album: raw.album || "", songmid: raw.id, picId: raw.picId || "", duration: raw.duration || 0 })).filter(x => x.id && x.title)',
    '  }',
    '  if (source === "tx" || source === "qq") {',
    '    const requestBody = {',
    '      comm: { _channelid: "0", _os_version: "6.2.9200-2", ct: "19", cv: "2151", guid: "1F70E520B2EAA7D25E11760783C53CA9", patch: "118", tmeAppID: "qqmusic", tmeLoginType: 0, uin: "0", wid: "7223299733393904640" },',
    '      "music.search.SearchCgiService": { module: "music.search.SearchCgiService", method: "DoSearchForQQMusicDesktop", param: { grp: 1, num_per_page: n, page_num: p, query: q, remoteplace: "txt.newclient.top", search_type: 0, searchid: crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").toUpperCase() : String(Date.now()) } }',
    '    }',
    '    const bodyText = JSON.stringify(requestBody)',
    '    const sign = await zzcSign(bodyText)',
    '    const resp = await fetch("https://u.y.qq.com/cgi-bin/musics.fcg?sign=" + sign, { method: "POST", headers: { "User-Agent": "QQMusic 14090508(android 12)", "Content-Type": "application/json" }, body: bodyText })',
    '    const data = await resp.json()',
    '    const req = data?.["music.search.SearchCgiService"] || data?.req',
    '    return ((req?.data?.body?.song?.list) || (req?.data?.song?.list) || []).map(raw => lxNormalizeSearchItem("tx", raw)).filter(Boolean)',
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
