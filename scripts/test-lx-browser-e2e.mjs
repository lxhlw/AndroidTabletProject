import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'https://whymusic-l101.pages.dev'
const sourceUrl = 'https://raw.githubusercontent.com/cdyUuu/lx-music-xinghai-source/main/xinghai-music-source.js'
const isLXCode = (code) => /(?:globalThis|window)(?:\\.lx|\\[\\s*['\"]lx['\"]\\s*\\])/.test(code)
  && /EVENT_NAMES(?:\\.inited|\\[\\s*['\"]inited['\"]\\s*\\])/.test(code)
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
    localStorage.clear()
    localStorage.setItem('whymusic-lang', 'zh-Hant')
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
          && typeof p.name === 'string'
          && typeof p.code === 'string'
          && p.code.includes('globalThis.lx')
          && p.code.includes('EVENT_NAMES.inited')
          && p.enabled !== false
        )
    } catch {
      return false
    }
  })

  const installed = await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
    return plugins.find((p) =>
      p?.code?.includes('globalThis.lx') && p?.code?.includes('EVENT_NAMES.inited')
    ) || null
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
      const lxPlugins = plugins.filter((p) =>
        p?.code?.includes('globalThis.lx') && p?.code?.includes('EVENT_NAMES.inited')
      )
      return lxPlugins.length === 1
    } catch {
      return false
    }
  })
  if (!duplicateCheck) throw new Error('Reinstall created duplicate LX plugin entries')

  const reinstallState = await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('musicfree-plugins') || '[]')
    const lxPlugins = plugins.filter((p) =>
      p?.code?.includes('globalThis.lx') && p?.code?.includes('EVENT_NAMES.inited')
    )
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
        && plugins.some((p) =>
          p?.code?.includes('globalThis.lx') && p?.code?.includes('EVENT_NAMES.inited') && p.enabled !== false
        )
    } catch {
      return false
    }
  })

  console.log('✓ Browser reload restored the persisted LX source')

  await page.getByRole('button', { name: '搜尋', exact: true }).click()
  const searchBox = page.getByPlaceholder('歌曲、歌手或專輯', { exact: true })
  await searchBox.fill('周杰伦')
  await page.getByRole('button', { name: '搜尋', exact: true }).click()

  await page.waitForFunction(() => document.body.innerText.includes('周杰伦'), null, { timeout: 60000 })
  console.log('✓ Restored LX source participated in a real production search')
  console.log('✓ LX browser E2E passed: install → persist → reload → search')
} finally {
  await browser.close()
}
