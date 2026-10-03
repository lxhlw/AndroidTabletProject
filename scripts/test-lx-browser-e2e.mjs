import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'https://whymusic-l101.pages.dev'
const sourceUrl = 'https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js'
const isLXCode = (code) => /(?:globalThis|window)(?:\\.lx|\\[\\s*['"]lx['"]\\s*\\])/.test(code)
  && /EVENT_NAMES(?:\\.inited|\\[\\s*['"]inited['"]\\s*\\])/.test(code)
  && !code.includes('module.exports =')

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const context = await browser.newContext({
    locale: 'zh-TW',
    viewport: { width: 1280, height: 900 },
  })

  await context.addInitScript(() => {
    if (sessionStorage.getItem('__lx_e2e_initialized') !== '1') {
      localStorage.clear()
      localStorage.setItem('__lx_e2e_initialized', '1')
      localStorage.setItem('whymusic-lang', 'zh-Hant')
      sessionStorage.setItem('__lx_e2e_initialized', '1')
    }
  })

  const page = await context.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  console.log('✓ Production web app loaded')

  await page.getByRole('button', { name: '設置', exact: true }).click()
  await page.getByPlaceholder('音源網址', { exact: true }).fill(sourceUrl)
  await page.getByRole('button', { name: '安裝', exact: true }).click()

  await page.waitForFunction(() => {
    try {
      const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
      return Array.isArray(plugins)
        && plugins.some((p) =>
          p
          && p.name === '六音音源'
          && typeof p.code === 'string'
          && p.code.length > 100000
          && p.code.includes('currentScriptInfo')
          && p.enabled !== false
        )
    } catch {
      return false
    }
  })

  const installed = await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
    return plugins.find((p) => p?.name === '六音音源') || null
  })

  if (!installed?.name || !installed?.code) {
    throw new Error('Installed LX plugin was not persisted in browser storage')
  }

  console.log('✓ Real LX URL installed through the production UI: ' + installed.name)
  console.log('✓ Installed LX source persisted in musicfree-plugins')

  // Re-install the same URL to verify upgrade/reinstall replaces the existing source
  // instead of creating duplicate plugin entries.
  await page.getByPlaceholder('音源網址', { exact: true }).fill(sourceUrl)
  await page.getByRole('button', { name: '安裝', exact: true }).click()

  const duplicateCheck = await page.waitForFunction(() => {
    try {
      const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
      const lxPlugins = plugins.filter((p) => p?.name === '六音音源')
      return lxPlugins.length === 1
    } catch {
      return false
    }
  })
  if (!duplicateCheck) throw new Error('Reinstall created duplicate LX plugin entries')

  const reinstallState = await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
    const lxPlugins = plugins.filter((p) => p?.name === '六音音源')
    return { count: lxPlugins.length, name: lxPlugins[0]?.name || '' }
  })

  if (reinstallState.count !== 1 || !reinstallState.name) {
    throw new Error('LX reinstall persistence state is invalid')
  }

  console.log('✓ Reinstall/upgrade replaces the existing LX plugin without duplicates')

  await page.reload({ waitUntil: 'networkidle' })

  await page.waitForFunction(() => {
    try {
      const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
      return Array.isArray(plugins)
        && plugins.some((p) => p?.name === '六音音源' && p.enabled !== false)
    } catch {
      return false
    }
  })

  console.log('✓ Browser reload restored the persisted LX source')

  // Keep only the real SixYin LX source enabled so the browser search result
  // cannot be satisfied by the bundled/official source instead.
  await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
    const onlySixYin = plugins.map((p) => ({
      ...p,
      enabled: p?.name === '六音音源',
    }))
    localStorage.setItem('musicfree-plugins', JSON.stringify(onlySixYin))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    try {
      const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
      return plugins.some((p) => p?.name === '六音音源' && p.enabled === true)
        && plugins.filter((p) => p?.enabled === true).every((p) => p?.name === '六音音源')
    } catch {
      return false
    }
  })
  console.log('✓ Browser search isolation left only SixYin enabled')

  await page.getByRole('button', { name: '搜尋', exact: true }).last().click()
  const searchBox = page.getByPlaceholder('歌曲、歌手或專輯', { exact: true })
  await searchBox.fill('晴天')
  await page.getByRole('button', { name: '搜尋', exact: true }).first().click()

  await page.waitForFunction(() => document.body.innerText.includes('晴天'), null, { timeout: 60000 })
  console.log('✓ Restored LX source participated in a real production search')

  // The LX compatibility bridge runs inside the plugin sandbox, so its internal
  // /api/lx-url fetch is not guaranteed to surface as a page-level network event.
  // Verify the user-visible contract instead: clicking the real SixYin result must
  // give the player a concrete playback URL.
  const sunnyDay = page.getByText('晴天', { exact: true }).first()
  await sunnyDay.click()

  const playbackSrc = await page.waitForFunction(() => {
    const audios = Array.from(document.querySelectorAll('audio'))
    const src = audios.map((audio) => audio.currentSrc).find(Boolean)
    if (!src || !document.body.innerText.includes('晴天')) return false
    if (src.startsWith('data:')) return false
    return src
  }, null, { timeout: 60000 })

  const resolvedSrc = await playbackSrc.jsonValue()
  if (typeof resolvedSrc !== 'string' || !resolvedSrc) {
    throw new Error('Playing the SixYin result did not produce a concrete audio source')
  }

  if (!resolvedSrc.startsWith('http://') && !resolvedSrc.startsWith('https://')
      && !resolvedSrc.includes('/api/proxy?url=')) {
    throw new Error('SixYin playback source is not an HTTP/proxied playback URL: ' + resolvedSrc)
  }

  console.log('✓ SixYin result reached the real player playback path')
  console.log('✓ Player received a resolved playback URL: ' + resolvedSrc.slice(0, 140))
  console.log('✓ LX browser E2E passed: install → persist → reload → search → play')
} finally {
  await browser.close()
}
