import { Plugin } from '../types'

export type LXCompatDeps = {
  pluginFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  requireFn: (packageName: string) => never
  console: {
    log: (...args: any[]) => void
    warn: (...args: any[]) => void
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
}

const LX_COMPAT_API = 'https://whymusic-l101.pages.dev'

const LX_TO_GD: Record<string, string> = {
  wy: 'netease',
  tx: 'qq',
  kg: 'kugou',
  kw: 'kuwo',
  mg: 'migu',
}

export function isLXMusicSourceCode(code: string): boolean {
  return /(?:globalThis|window)\\.lx/.test(code)
    && /EVENT_NAMES\\.inited/.test(code)
    && !/module\\.exports\\s*=/.test(code)
}

function lxMeta(code: string): {
  name: string
  description?: string
  version: string
  author?: string
} {
  const read = (key: string, fallback = '') => {
    const m = code.match(new RegExp('@' + key + '\\s+([^\\r\\n*]+)'))
    return m?.[1]?.trim() || fallback
  }
  return {
    name: read('name', 'LX Music Source'),
    description: read('description') || undefined,
    version: read('version', '1.0.0'),
    author: read('author') || undefined,
  }
}

function lxArtist(value: any): string {
  if (Array.isArray(value)) {
    return value
      .map(v => typeof v === 'string' ? v : v?.name)
      .filter(Boolean)
      .join(' / ')
  }
  if (value && typeof value === 'object' && value.name) return String(value.name)
  return String(value || '')
}

function lxItem(raw: any, source: string): any {
  const id = raw?.songmid ?? raw?.mid ?? raw?.url_id ?? raw?.id ?? raw?.hash
  const title = String(raw?.name ?? raw?.title ?? '')
  const artist = lxArtist(raw?.artist ?? raw?.artists ?? raw?.singer ?? raw?.singers)
  if (!id || !title) return null
  return {
    id: String(id),
    title,
    artist,
    album: String(raw?.album ?? raw?.albumName ?? raw?.album_name ?? ''),
    platform: '',
    source,
    subSource: source,
    type: 'music',
    lxSource: source,
    lxInfo: raw,
    lxAlternatives: [],
  }
}

function lxKey(item: any): string {
  const normalize = (value: any) => String(value || '')
    .toLowerCase()
    .replace(/[\\s\\-_·・,，.。!！?？'"、/\\\\|&+]/g, '')
  return normalize(item?.title) + '::' + normalize(item?.artist)
}

function lxQuality(requested: string, available: string[]): string {
  const candidates: Record<string, string[]> = {
    '128': ['128k'],
    '192': ['192k', '128k'],
    '320': ['320k', '192k', '128k'],
    '740': ['flac', 'flac24bit', 'hires', '320k', '192k', '128k'],
    '999': ['flac24bit', 'hires', 'flac', 'master', '320k', '192k', '128k'],
  }
  for (const q of candidates[String(requested)] || [String(requested)]) {
    if (available.includes(q)) return q
  }
  return available[0] || '320k'
}

export function buildLXPlugin(code: string, deps: LXCompatDeps): Plugin {
  const meta = lxMeta(code)
  const requestHandlers: any[] = []
  let initPayload: any = null
  const events: Record<string, any[]> = {}
  const EVENT_NAMES = {
    inited: 'inited',
    request: 'request',
    updateAlert: 'updateAlert',
  }

  const fakeLX: any = {
    version: '1.14.0',
    EVENT_NAMES,
    env: { platform: 'web', version: 'WhyMusic LX compatibility' },

    request(targetUrl: string, options: any = {}, callback: any) {
      Promise.resolve().then(async () => {
        const method = String(options?.method || 'GET').toUpperCase()
        const headers = { ...(options?.headers || {}) }
        let body = options?.body
        if (body && typeof body !== 'string' && typeof body === 'object') {
          body = JSON.stringify(body)
        }

        const target = String(targetUrl)
        const requestUrl = /^https?:\/\//i.test(target)
          ? LX_COMPAT_API + '/api/proxy?url=' + encodeURIComponent(target)
            + '&method=' + encodeURIComponent(method)
          : target

        const response = await deps.pluginFetch(requestUrl, {
          method,
          headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : body,
        })

        const bodyText = await response.text()
        let parsedBody: any = bodyText
        if (/^[\\[{]/.test(bodyText.trim())) {
          try { parsedBody = JSON.parse(bodyText) } catch {}
        }

        const responseHeaders: Record<string, string> = {}
        try {
          response.headers.forEach((value, key) => { responseHeaders[key] = value })
        } catch {}

        callback(null, {
          body: parsedBody,
          statusCode: response.status,
          headers: responseHeaders,
        })
      }).catch((err: any) => callback(err))
    },

    on(event: string, handler: any) {
      if (!events[event]) events[event] = []
      events[event].push(handler)
      if (event === EVENT_NAMES.request && typeof handler === 'function') {
        requestHandlers.push(handler)
      }
    },

    send(event: string, payload: any) {
      if (event === EVENT_NAMES.inited) initPayload = payload
      for (const handler of events[event] || []) {
        try { handler(payload) } catch (err) { deps.console.warn('[LX] event error', err) }
      }
    },
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: deps.requireFn,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => deps.pluginFetch(input, init),
    URL,
    URLSearchParams,
    btoa: (str: string) => btoa(str),
    atob: (str: string) => atob(str),
    console: deps.console,
  }

  // globalThis/window 都是假的，避免 LX 源直接碰到真正的页面 window。
  const argNames = ['globalThis', 'window', ...Object.keys(sandbox)]
  const argValues = [{ lx: fakeLX }, { lx: fakeLX }, ...Object.values(sandbox)]
  const pluginFunc = new Function(...argNames, code)
  pluginFunc(...argValues)

  if (!initPayload?.status || !initPayload?.sources) {
    throw new Error('LX 音源没有发送有效的 EVENT_NAMES.inited')
  }

  const sources = Object.entries(initPayload.sources).filter(([key, info]: any) => {
    return /^(wy|tx|kg|kw|mg)$/.test(key) && info?.type === 'music'
  }) as [string, any][]

  if (sources.length === 0) {
    throw new Error('LX 音源没有声明 wy/tx/kg/kw/mg 音乐源')
  }

  const invoke = async (source: string, action: string, info: any) => {
    let last: any = null
    for (const handler of requestHandlers) {
      try {
        const value = await Promise.resolve(handler({ source, action, info }))
        if (value !== undefined && value !== null && value !== '') return value
      } catch (err) {
        last = err
      }
    }
    throw last || new Error('LX 音源没有返回结果')
  }

  const plugin: any = {
    name: meta.name,
    platform: meta.name,
    version: meta.version,
    description: meta.description,
    author: meta.author,

    async search(query: string, page = 1, type = 'music') {
      if (type !== 'music') return { data: [], isEnd: true }

      const buckets = await Promise.all(
        sources.map(async ([source]) => {
          const apiSource = LX_TO_GD[source] || source
          const url = LX_COMPAT_API + '/api/lx-search?source=' + encodeURIComponent(apiSource)
            + '&q=' + encodeURIComponent(query)
            + '&page=' + encodeURIComponent(String(page))
            + '&count=20'
          const response = await deps.pluginFetch(url, { cache: 'no-store' })
          if (!response.ok) {
            throw new Error('LX search ' + source + ' HTTP ' + response.status)
          }
          const payload = await response.json()
          return (Array.isArray(payload?.data) ? payload.data : [])
            .map((raw: any) => lxItem(raw, source))
            .filter(Boolean)
        }),
      )

      const merged = new Map<string, any>()
      for (const bucket of buckets) {
        for (const item of bucket) {
          const key = lxKey(item)
          const old = merged.get(key)
          if (!old) {
            merged.set(key, item)
          } else {
            old.lxAlternatives.push({
              id: item.id,
              source: item.subSource,
              lxInfo: item.lxInfo,
            })
          }
        }
      }

      return {
        data: Array.from(merged.values()),
        isEnd: buckets.every(bucket => bucket.length < 20),
      }
    },

    async getMediaSource(item: any, quality = '320') {
      const candidates = [
        {
          id: item?.id,
          source: item?.subSource,
          lxInfo: item?.lxInfo || {},
        },
        ...(Array.isArray(item?.lxAlternatives) ? item.lxAlternatives : []),
      ].filter(v => v.id && v.source)

      let last: any = null
      for (const candidate of candidates) {
        const sourceInfo = initPayload.sources[candidate.source]
        if (!sourceInfo) continue

        const available = Array.isArray(sourceInfo.qualitys) ? sourceInfo.qualitys : []
        const wanted = lxQuality(String(quality), available)
        const musicInfo = {
          ...(candidate.lxInfo || {}),
          id: candidate.id,
          songmid: candidate.lxInfo?.songmid || candidate.id,
          name: candidate.lxInfo?.name || item?.title || '',
          title: candidate.lxInfo?.title || item?.title || '',
          singer: candidate.lxInfo?.singer || item?.artist || '',
          artist: candidate.lxInfo?.artist || item?.artist || '',
          album: candidate.lxInfo?.album || item?.album || '',
          albumName: candidate.lxInfo?.albumName || item?.album || '',
        }

        try {
          const value = await invoke(candidate.source, 'musicUrl', {
            type: wanted,
            musicInfo,
          })
          const url = typeof value === 'string' ? value : value?.url
          if (url) {
            return {
              url: String(url),
              source: candidate.source,
              quality: wanted,
            }
          }
        } catch (err) {
          last = err
          deps.console.warn('[LX] playback failed ' + candidate.source, err)
        }
      }

      throw last || new Error('LX 音源没有可用播放地址')
    },

    async getLyric(item: any) {
      const source = item?.subSource
      if (!source) return { rawLrc: '' }

      try {
        const value = await invoke(source, 'lyric', {
          type: null,
          musicInfo: { ...(item?.lxInfo || {}), id: item?.id, songmid: item?.id },
        })
        if (typeof value === 'string') return { rawLrc: value }
        return {
          rawLrc: String(value?.lyric || value?.rawLrc || ''),
          translation: String(value?.tlyric || ''),
        }
      } catch {
        return { rawLrc: '' }
      }
    },
  }

  return plugin as Plugin
}
