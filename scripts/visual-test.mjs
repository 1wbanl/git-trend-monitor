import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean)
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate))
if (!executablePath) {
  console.error('No local Chromium browser found. Set BROWSER_PATH to Chrome or Edge.')
  process.exit(1)
}
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:8787'
const OUT = path.resolve('screenshots')
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
})
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai'
})
const page = await context.newPage()
const issues = []
page.on('console', (message) => {
  if (message.type() === 'error') issues.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`))
page.on('requestfailed', (request) => {
  if (!request.url().includes('favicon')) issues.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`)
})

async function open(pathname, wait = 1300) {
  await page.goto(`${BASE}${pathname}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
}

async function snap(name, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
  const metrics = await page.evaluate(() => ({
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: document.body.innerText.slice(0, 180),
    cards: document.querySelectorAll('.panel, .project-card, .rule-card').length
  }))
  if (metrics.scrollWidth > metrics.innerWidth + 1) {
    issues.push(`${name}: horizontal overflow ${metrics.scrollWidth} > ${metrics.innerWidth}`)
  }
  console.log(name, JSON.stringify(metrics))
}

try {
  await open('/')
  await snap('01-overview')

  await page.locator('.mover-row').first().click()
  await page.waitForTimeout(500)
  await snap('02-project-drawer', false)
  await page.locator('.drawer-icon-button[aria-label="关闭详情"]').click()
  await page.waitForTimeout(300)

  await open('/trends')
  await snap('03-trends')
  await page.locator('.project-card').first().click()
  await page.waitForTimeout(450)
  await page.locator('.drawer-icon-button[aria-label="关闭详情"]').click()

  await open('/library')
  await snap('04-library')

  await open('/alerts')
  await snap('05-alerts')
  await page.getByRole('button', { name: '新建规则' }).first().click()
  await page.waitForTimeout(500)
  await snap('06-alert-modal', false)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await open('/assistant')
  await snap('07-assistant-empty', false)
  await page.locator('.suggestion-card').first().click()
  await page.locator('.assistant-message .markdown').waitFor({ timeout: 25000 })
  await page.waitForTimeout(3500)
  await page.locator('.chat-scroll').evaluate((element) => {
    element.scrollTop = 0
  })
  await page.waitForTimeout(350)
  await snap('08-assistant-answer', false)

  await open('/sources')
  await snap('09-sources')

  await page.locator('.search-trigger').click()
  await page.waitForTimeout(400)
  await snap('10-command-palette', false)
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 390, height: 844 })
  await open('/')
  await page.waitForTimeout(500)
  await snap('11-mobile-overview')
  await open('/trends')
  await snap('12-mobile-trends')
  await open('/library')
  await snap('13-mobile-library')
  await open('/alerts')
  await snap('14-mobile-alerts')
  await page.goto(`${BASE}/assistant`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await snap('15-mobile-assistant', false)
} catch (error) {
  issues.push(`test failure: ${error.message}`)
  await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: false })
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ issues }, null, 2))
  console.log(`ISSUES (${issues.length})`)
  issues.forEach((issue) => console.log(issue))
  await browser.close()
}
