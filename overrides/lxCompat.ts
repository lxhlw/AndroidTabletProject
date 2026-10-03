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
  const isCommonJSPlugin =
    code.includes('module.exports')
    || code.includes('exports.')

  const hasLXNamespace =
    code.includes('globalThis.lx')
    || code.includes("globalThis['lx']")
    || code.includes('globalThis["lx"]')
    || code.includes('window.lx')
    || code.includes("window['lx']")
    || code.includes('window["lx"]')

  // Some real LX sources are bundled/minified and rewrite EVENT_NAMES.inited
  // into computed property names, so the literal init event is not always preserved.
  const hasLXApiBinding =
    /(?:const|let|var)\s*\{[^}]*\bEVENT_NAMES\b[^}]*\b(?:on|send|request)\b[^}]*\}\s*=\s*(?:globalThis|window)(?:\.lx|\[['"]lx['"]\])/s.test(code)

  const hasLXInitEvent =
    code.includes('EVENT_NAMES.inited')
    || code.includes("EVENT_NAMES['inited']")
    || code.includes('EVENT_NAMES["inited"]')

  const hasLXEventProtocol = hasLXInitEvent || hasLXApiBinding

  // 标准 LX 有时只留下 inited 协议触点；打包源则可能暴露 API 解构。
  // 三者任一成立即可作为协议动作证据，普通包含 "lx" 文本仍不会通过。
  const hasLXAction =
    code.includes('musicUrl')
    || code.includes('getMediaSource')
    || hasLXInitEvent
    || hasLXApiBinding

  return hasLXNamespace
    && hasLXEventProtocol
    && hasLXAction
    && !isCommonJSPlugin
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
  let initResolve: ((value: any) => void) | null = null
  let initReject: ((reason?: any) => void) | null = null
  let initTimer: ReturnType<typeof setTimeout> | null = null
  const initReady = new Promise<any>((resolve, reject) => {
    initResolve = resolve
    initReject = reject
    initTimer = setTimeout(() => reject(new Error('LX 音源初始化超时')), 15000)
  })
  const events: Record<string, any[]> = {}
  const EVENT_NAMES = {
    inited: 'inited',
    request: 'request',
    updateAlert: 'updateAlert',
  }

  const fakeLX: any = {
    // LX 自定义音源运行时的兼容字段。
    // 部分混淆音源会读取 currentScriptInfo 来做宿主/脚本版本校验，
    // 因此不能只提供 EVENT_NAMES/request/on/send。
    version: '2.0.0',
    EVENT_NAMES,
    env: 'desktop',
    currentScriptInfo: {
      name: meta.name,
      description: meta.description || '',
      version: meta.version || '1.0.0',
      author: meta.author || '',
      homepage: 'https://www.sixyin.com',
      rawScript: code,
    },

    request(targetUrl: string, options: any = {}, callback: any) {
      Promise.resolve().then(async () => {
        const method = String(options?.method || 'GET').toUpperCase()
        const headers = { ...(options?.headers || {}) }
        let body = options?.body
        let requestHeaders = { ...(options?.headers || {}) }
        if (options?.form && typeof options.form === 'object') {
          body = Object.entries(options.form).map(([key, value]) =>
            encodeURIComponent(key) + '=' + encodeURIComponent(String(value)),
          ).join('&')
          requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/x-www-form-urlencoded'
        } else if (options?.formData && typeof options.formData === 'object') {
          body = Object.entries(options.formData).map(([key, value]) =>
            encodeURIComponent(key) + '=' + encodeURIComponent(String(value)),
          ).join('&')
          requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/x-www-form-urlencoded'
        } else if (body && typeof body !== 'string' && typeof body === 'object') {
          body = JSON.stringify(body)
        }

        const target = String(targetUrl)
        const requestUrl = /^https?:\/\//i.test(target)
          ? LX_COMPAT_API + '/api/proxy?url=' + encodeURIComponent(target)
            + '&method=' + encodeURIComponent(method)
          : target

        const response = await deps.pluginFetch(requestUrl, {
          method,
          headers: requestHeaders,
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
      if (event === EVENT_NAMES.inited) {
        initPayload = payload
        if (initTimer) {
          clearTimeout(initTimer)
          initTimer = null
        }
        if (initPayload?.sources && initPayload?.status !== false) initResolve?.(initPayload)
        else initReject?.(new Error('LX 音源初始化失败'))
      }
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


  function lxMd5(input: string): string {
    const bytes = new TextEncoder().encode(String(input))
    const bitLen = bytes.length * 8
    const len = ((bytes.length + 9 + 63) >> 6) << 6
    const msg = new Uint8Array(len)
    msg.set(bytes)
    msg[bytes.length] = 0x80
    const view = new DataView(msg.buffer)
    view.setUint32(len - 8, bitLen >>> 0, true)
    view.setUint32(len - 4, Math.floor(bitLen / 0x100000000), true)

    const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n))
    const add = (a: number, b: number) => (a + b) >>> 0
    let a0 = 0x67452301
    let b0 = 0xefcdab89
    let c0 = 0x98badcfe
    let d0 = 0x10325476
    const k = new Uint32Array([
      0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
      0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
      0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
      0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
      0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
      0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
      0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
      0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391,
    ])
    const s = [
      7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
      5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
      4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
      6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
    ]
    for (let offset = 0; offset < len; offset += 64) {
      const m = new Uint32Array(16)
      for (let i = 0; i < 16; i++) m[i] = view.getUint32(offset + i * 4, true)
      let a = a0, b = b0, c = c0, d = d0
      for (let i = 0; i < 64; i++) {
        let f = 0
        let g = 0
        if (i < 16) { f = (b & c) | (~b & d); g = i }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15 }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15 }
        else { f = c ^ (b | ~d); g = (7 * i) & 15 }
        const next = d
        const mixed = add(add(add(a, f >>> 0), k[i]), m[g])
        d = c
        c = b
        b = add(b, rol(mixed, s[i]))
        a = next
      }
      a0 = add(a0, a)
      b0 = add(b0, b)
      c0 = add(c0, c)
      d0 = add(d0, d)
    }
    const out = new Uint8Array(16)
    const outView = new DataView(out.buffer)
    outView.setUint32(0, a0, true)
    outView.setUint32(4, b0, true)
    outView.setUint32(8, c0, true)
    outView.setUint32(12, d0, true)
    return Array.from(out, x => x.toString(16).padStart(2, '0')).join('')
  }

  const lxUtils = {
    buffer: {
      from(value: any, encoding = 'utf-8') {
        const text = String(value ?? '')
        if (encoding === 'base64') {
          const binary = atob(text)
          return new Uint8Array(Array.from(binary, ch => ch.charCodeAt(0)))
        }
        if (encoding === 'hex') {
          const normalized = text.replace(/[^0-9a-f]/gi, '')
          const out = new Uint8Array(Math.floor(normalized.length / 2))
          for (let i = 0; i < out.length; i++) out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
          return out
        }
        if (encoding === 'binary' || encoding === 'latin1') {
          return new Uint8Array(Array.from(text, ch => ch.charCodeAt(0) & 0xff))
        }
        return new TextEncoder().encode(text)
      },
      bufToString(buffer: any, encoding = 'utf-8') {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || [])
        if (encoding === 'base64') {
          let binary = ''
          for (const b of bytes) binary += String.fromCharCode(b)
          return btoa(binary)
        }
        if (encoding === 'hex') {
          return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
        }
        if (encoding === 'binary' || encoding === 'latin1') {
          return Array.from(bytes, b => String.fromCharCode(b)).join('')
        }
        return new TextDecoder('utf-8').decode(bytes)
      },
    },
  }
  fakeLX.utils = {
    ...lxUtils,
    crypto: {
      md5: lxMd5,
      randomBytes(size: number) {
        const n = Math.max(0, Number(size) || 0)
        const out = new Uint8Array(n)
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out)
        else for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256)
        return out
      },
    },
  }

  // globalThis/window 都是假的，避免 LX 源直接碰到真正的页面 window。
  const argNames = ['globalThis', 'window', ...Object.keys(sandbox)]
  const argValues = [{ lx: fakeLX }, { lx: fakeLX }, ...Object.values(sandbox)]
  const pluginFunc = new Function(...argNames, code)
  pluginFunc(...argValues)

  const getInit = async () => {
    if (initPayload?.sources && initPayload?.status !== false) return initPayload
    return await initReady
  }

  const getSources = async () => {
    const payload = await getInit()
    return Object.entries(payload.sources).filter(([key, info]: any) => {
      return /^(wy|tx|kg|kw|mg)$/.test(key) && info?.type === 'music'
    }) as [string, any][]
  }

  // LX 源可能异步发送 inited，不能在这里同步检查 sources。

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

      const activeSources = await getSources()
      const settled = await Promise.allSettled(
        activeSources.map(async ([source]) => {
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
      const buckets = settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value
        deps.console.warn('[LX] search failed ' + activeSources[index][0], result.reason)
        return []
      })

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
        isEnd: settled.every(result => result.status === 'fulfilled' && result.value.length < 20),
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
        const payload = await getInit()
        const sourceInfo = payload.sources[candidate.source]
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

    async getArtwork(item: any) {
      const source = item?.subSource
      if (!source) return ''
      try {
        const value = await invoke(source, 'pic', {
          type: null,
          musicInfo: { ...(item?.lxInfo || {}), id: item?.id, songmid: item?.id },
        })
        if (typeof value === 'string') return value
        return String(value?.url || value?.pic || value?.artwork || '')
      } catch {
        return ''
      }
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
