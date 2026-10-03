/**
 * WhyMusic 官方插件
 *
 * 这是前端与 WhyMusic Worker API 之间的薄适配层。
 * 插件本身不依赖第三方模块，只使用播放器沙箱提供的 fetch / URLSearchParams。
 */
const API_PREFIX = '/api'

async function requestJson(path) {
  const response = await fetch(API_PREFIX + path, { cache: 'no-store' })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`WhyMusic API 返回非 JSON（HTTP ${response.status}）`)
  }
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`)
  }
  return data
}

function query(params) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    q.set(key, String(value))
  }
  return '?' + q.toString()
}

function normalizeMusicItem(item) {
  return {
    ...item,
    platform: 'WhyMusic',
    type: item?.type || 'music',
  }
}

const plugin = {
  name: 'WhyMusic',
  platform: 'WhyMusic',
  version: '1.0.0',
  description: 'WhyMusic official source adapter',
  author: 'WhyMusic',

  async search(keyword, page = 1, type = 'music') {
    if (type === 'album') {
      const data = await requestJson('/why-album-search' + query({
        kw: keyword,
        page,
        limit: 20,
      }))
      return {
        data: Array.isArray(data?.data)
          ? data.data.map(normalizeMusicItem)
          : [],
        isEnd: !(Array.isArray(data?.data) && data.data.length >= 20),
      }
    }

    // WhyMusic Worker 当前歌曲搜索统一走 music 类型。
    const data = await requestJson('/why-search' + query({
      q: keyword,
      type: 'music',
      page,
      count: 20,
    }))

    const items = Array.isArray(data?.data)
      ? data.data.map(normalizeMusicItem)
      : []

    return {
      data: items,
      isEnd: items.length < 20,
    }
  },

  async getMediaSource(item, quality = '320') {
    const bitrate = /^d+$/.test(String(quality)) ? String(quality) : '320'
    const data = await requestJson('/why-url' + query({
      id: item?.id || '',
      title: item?.title || '',
      artist: item?.artist || '',
      source: item?.subSource || item?.source || '',
      br: bitrate,
      exclude: Array.isArray(item?._exclude) ? item._exclude.join(',') : '',
    }))

    if (!data?.url) {
      throw new Error('WhyMusic 没有返回可播放的音源 URL')
    }

    return {
      url: data.url,
      source: data.source || item?.subSource || '',
      quality: bitrate,
      bitrate: Number(bitrate),
    }
  },

  async getLyric(item) {
    const lyricId = item?.lyricId || item?.id || ''
    if (!lyricId) return { rawLrc: '' }

    const data = await requestJson('/why-lyric' + query({
      id: lyricId,
      source: item?.subSource || item?.source || '',
    }))

    return {
      rawLrc: data?.lyric || '',
      translation: data?.tlyric || '',
    }
  },

  async getAlbumInfo(item) {
    const id = item?.id || ''
    if (!id) return { musicList: [] }

    const data = await requestJson('/why-album' + query({ id }))
    const tracks = Array.isArray(data?.data) ? data.data : []

    return {
      musicList: tracks.map(normalizeMusicItem),
    }
  },

  async getRecommend(category = 'cantonese', limit = 40, seed = 0) {
    const data = await requestJson('/recommend' + query({
      cat: category,
      limit,
      seed,
    }))

    return {
      data: Array.isArray(data?.data)
        ? data.data.map(normalizeMusicItem)
        : [],
      caption: typeof data?.category === 'string'
        ? `WhyMusic · ${data.category}`
        : undefined,
    }
  },
}

module.exports = plugin
