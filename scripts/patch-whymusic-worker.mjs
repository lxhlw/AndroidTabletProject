import { readFileSync, writeFileSync } from 'node:fs'

const path = 'packages/web/worker/why.js'
let source = readFileSync(path, 'utf8')

function replaceOnce(text, pattern, replacement, label) {
  const match = text.match(pattern)
  if (!match) throw new Error(`找不到要修改的函数：${label}`)
  return text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length)
}

// 1) 搜索兜底：GD 全部失败时直接走网易云公开搜索。
if (!source.includes('async function searchWhyMusicNetease(')) {
  const helper = `async function searchWhyMusicNetease(keyword, page = 1, count = 20) {
  const offset = (Math.max(1, Number(page) || 1) - 1) * count
  const data = await neteaseFetch(
    '/api/search/get?s=' + encodeURIComponent(keyword)
    + '&type=1&limit=' + count + '&offset=' + offset,
  )
  const songs = (data && data.result && data.result.songs) || []
  return songs.map(gdTrackToItem).filter(Boolean)
}

`
  source = source.replace(
    'async function searchWhyMusic(keyword, page = 1, count = 20) {',
    helper + 'async function searchWhyMusic(keyword, page = 1, count = 20) {',
  )
}

source = replaceOnce(
  source,
  /async function searchWhyMusic\(keyword, page = 1, count = 20\) \{[\s\S]*?\n\}\n\nasync function getGdUrl\(/,
  String.raw`async function searchWhyMusic(keyword, page = 1, count = 20) {
  const settled = await Promise.allSettled(
    WHY_SOURCES.map(source => searchWhySubSource(source, keyword, page, count)),
  )
  const buckets = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.error(\`[why] search failed on \${WHY_SOURCES[i]}: \${r.reason?.message}\`)
    return []
  })

  if (settled.every(r => r.status === 'rejected')) {
    try {
      const fallback = await searchWhyMusicNetease(keyword, page, count)
      if (fallback.length > 0) return fallback
    } catch (err) {
      console.error('[why] netease fallback search failed:', err?.message)
    }
    throw new Error(
      \`所有子音源都失败：\${settled.map((r, i) => \`\${WHY_SOURCES[i]}（\${r.reason?.message}）\`).join('；')}\`,
    )
  }

  const seen = new Set()
  const merged = []
  const maxLen = Math.max(0, ...buckets.map(b => b.length))
  for (let idx = 0; idx < maxLen; idx++) {
    for (const bucket of buckets) {
      const item = bucket[idx]
      if (!item || !item.id || !item.title) continue
      const key = \`\${gdNormalizeName(item.title)}::\${gdNormalizeName(item.artist)}\`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }
  return merged
}

async function getGdUrl(`,
  'searchWhyMusic',
)

// 2) 播放兜底：网易云歌曲的 GD URL 失败时使用官方外部媒体入口。
if (!source.includes('function getNeteaseOuterUrl(')) {
  const helper = `function getNeteaseOuterUrl(songId) {
  if (!songId) return ''
  return 'https://music.163.com/song/media/outer/url?id='
    + encodeURIComponent(songId) + '.mp3'
}

`
  source = source.replace(
    'async function getWhySubSourceUrl(songId, source, bitrate = GD_BITRATE) {',
    helper + 'async function getWhySubSourceUrl(songId, source, bitrate = GD_BITRATE) {',
  )
}

source = replaceOnce(
  source,
  /async function getWhySubSourceUrl\(songId, source, bitrate = GD_BITRATE\) \{[\s\S]*?\n\}/,
  String.raw`async function getWhySubSourceUrl(songId, source, bitrate = GD_BITRATE) {
  if (source === AUDIOMACK_SOURCE) return await getAudiomackMedia(songId)
  try {
    const url = await getGdUrl(songId, source, bitrate)
    if (url) return url
  } catch (err) {
    console.error('[why] GD url failed ' + source + '/' + songId + ': ' + (err?.message || err))
  }
  if (source === 'netease') return getNeteaseOuterUrl(songId)
  return ''
}`,
  'getWhySubSourceUrl',
)

// 3) 歌词：上游失败时返回空 payload，不影响播放。
source = replaceOnce(
  source,
  /async function getWhyMusicLyric\(lyricId, source\) \{[\s\S]*?\n\}\n\nasync function getWhyMusicPic/,
  String.raw`async function getWhyMusicLyric(lyricId, source) {
  if (source === AUDIOMACK_SOURCE) return { lyric: '', tlyric: '' }
  try {
    const data = await gdRequest('lyric', { source, id: lyricId })
    return { lyric: data?.lyric || '', tlyric: data?.tlyric || '' }
  } catch (err) {
    console.error('[why] lyric unavailable:', err?.message)
    return { lyric: '', tlyric: '' }
  }
}

async function getWhyMusicPic`,
  'getWhyMusicLyric',
)

// 4) 推荐：GD 榜单失败时直接走网易云歌单详情。
if (!source.includes('async function recommendWhyMusicNetease(')) {
  const helper = `async function recommendWhyMusicNetease(category = DEFAULT_CATEGORY, limit = 40, seed = '0') {
  const cat = GD_CATEGORIES[category] || GD_CATEGORIES[DEFAULT_CATEGORY]
  const data = await neteaseFetch(
    '/api/v6/playlist/detail?id=' + encodeURIComponent(cat.list),
  )
  const tracks = (data && data.playlist && data.playlist.tracks) || []
  const items = tracks.map(gdTrackToItem).filter(Boolean)
  if (!items.length) return []
  return dailyShuffle(items, limit, cat.list + ':' + seed)
}

`
  const marker = '/**\n * 推薦：取一份榜單、去重、裁到 limit。'
  if (!source.includes(marker)) throw new Error('找不到推荐函数前的插入位置')
  source = source.replace(marker, helper + marker)
}

source = replaceOnce(
  source,
  /async function recommendWhyMusic\b[\s\S]*?\n\s*export \{/,
  String.raw`async function recommendWhyMusic(category = DEFAULT_CATEGORY, limit = 40, seed = '0') {
  const cat = GD_CATEGORIES[category] || GD_CATEGORIES[DEFAULT_CATEGORY]
  const orders = cat.orders || ['chart']
  const bucket = Math.floor(Date.now() / ROTATE_BUCKET_MS)
  const cacheKey = \`rec:\${cat.list}:\${orders.join('+')}:\${limit}:\${bucket}:\${seed}\`
  const cached = gdCacheGet(cacheKey)
  if (cached !== undefined) return cached

  let tracks = []
  try {
    const data = await gdRequest('playlist', { source: 'netease', id: cat.list })
    tracks = data?.playlist?.tracks || []
  } catch (err) {
    console.error('[why] GD recommend failed:', err?.message)
    const fallback = await recommendWhyMusicNetease(category, limit, seed)
    gdCacheSet(cacheKey, fallback, GD_TTL.playlist)
    return fallback
  }

  const buckets = orders.map(
    order => sortTracks(tracks, order).map(gdTrackToItem).filter(Boolean),
  )
  const seen = new Set()
  const merged = []
  const maxLen = Math.max(0, ...buckets.map(b => b.length))
  for (let idx = 0; idx < maxLen; idx++) {
    for (const b of buckets) {
      const item = b[idx]
      if (!item) continue
      const key = \`\${gdNormalizeName(item.title)}::\${gdNormalizeName(item.artist)}\`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }
  const out = dailyShuffle(merged, limit, \`\${cat.list}:\${seed}\`)
  gdCacheSet(cacheKey, out, GD_TTL.playlist)
  return out
}

export {`,
  'recommendWhyMusic',
)

source = source.replaceAll("\\`", "`").replaceAll("\\${", "${")
writeFileSync(path, source)
console.log('✓ WhyMusic worker fallbacks patched')
