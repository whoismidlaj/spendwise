import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.invalid`
const password = 'e2e-password-1'

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/register', { data: { name: 'E2E User', email, password } })
  expect(response.status()).toBe(201)
})

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
}

const navigate = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()

test.describe('primary navigation', () => {
  test('the four main areas open and show consistent names', async ({ page }) => {
    await login(page)
    for (const [name, url, heading] of [['Payments', /\/payments$/, 'Payments'], ['Accounts', /\/accounts/, 'Accounts'], ['Income', /\/income$/, 'Income'], ['Plan', /\/dashboard$/, 'Plan']] as const) {
      await navigate(page, name)
      await expect(page).toHaveURL(url)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })

  test('old routes redirect to their canonical destinations', async ({ page }) => {
    await login(page)
    await page.goto('/bills')
    await expect(page).toHaveURL(/\/payments$/)
    await page.goto('/debts')
    await expect(page).toHaveURL(/\/accounts\?section=loans$/)
    await page.goto('/transactions')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('account sections live in the URL: refresh, back and shared links keep the selection', async ({ page }) => {
    await login(page)
    await page.goto('/accounts?section=recurring')
    await expect(page.getByRole('tab', { name: 'Recurring' })).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Recurring' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Loans & debts' }).click()
    await expect(page).toHaveURL(/section=loans/)
    await page.goBack()
    await expect(page.getByRole('tab', { name: 'Recurring' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Recurring' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Loans & debts' })).toBeFocused()
  })

  test('Payments has no record-creation form', async ({ page }) => {
    await login(page)
    await page.goto('/payments')
    await expect(page.getByText('No payments this month')).toBeVisible()
    await expect(page.getByRole('button', { name: /^add/i })).toHaveCount(0)
  })
})

test.describe('end-to-end money flows', () => {
  test('recurring payment: add, see it in Payments, mark paid and unpaid', async ({ page }) => {
    await login(page)
    await page.goto('/accounts?section=banks')
    await page.getByRole('button', { name: 'Add account' }).click()
    await page.getByLabel('Account name').fill('E2E Bank')
    await page.getByLabel('Opening balance').fill('5000')
    await page.getByRole('button', { name: 'Add account', exact: true }).last().click()
    await expect(page.getByText('E2E Bank')).toBeVisible()

    await page.goto('/accounts?section=recurring')
    await page.getByRole('button', { name: 'Add recurring payment' }).click()
    await page.getByLabel('Payment name').fill('E2E Internet')
    await page.getByLabel('Amount').fill('700')
    await page.getByLabel('Due day').fill(String(new Date().getDate()))
    await page.getByRole('button', { name: 'Add payment' }).click()
    await expect(page.getByText('E2E Internet')).toBeVisible()

    await page.goto('/payments')
    await expect(page.getByText('E2E Internet')).toBeVisible()
    await page.getByRole('button', { name: 'Mark E2E Internet paid' }).click()
    await page.getByLabel('Paid from account').selectOption({ label: 'E2E Bank' })
    await page.getByRole('button', { name: 'Mark paid', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Paid/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark E2E Internet unpaid' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark E2E Internet unpaid' }).click()
    await page.getByRole('button', { name: 'Mark unpaid', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Mark E2E Internet paid' })).toBeVisible()
  })

  test('loan from a lender schedule shows principal and interest and can be paid', async ({ page }) => {
    await login(page)
    await page.goto('/accounts?section=loans')
    await page.getByRole('button', { name: 'Add loan or debt' }).click()
    await page.getByRole('radio', { name: 'Lender schedule' }).click()
    await page.getByLabel('Loan or lender name').fill('E2E Loan')
    await page.getByLabel('Original principal').fill('3000')
    const next = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); d.setDate(15); return d.toISOString().slice(0, 10) }
    await page.getByLabel('Paste from a spreadsheet').fill([`${next(1)}, 1100, 1000, 100`, `${next(2)}, 1050, 950, 100`, `${next(3)}, 1160, 1050, 110`].join('\n'))
    await page.getByRole('button', { name: 'Replace rows with pasted schedule' }).click()
    await expect(page.getByText('Installments (3)')).toBeVisible()
    await page.getByRole('button', { name: 'Add loan or debt' }).last().click()
    await expect(page.getByText('E2E Loan')).toBeVisible()
    await page.getByRole('button', { name: 'Details' }).click()
    await expect(page.getByText('Lender schedule').first()).toBeVisible()
    await expect(page.getByText('Future interest')).toBeVisible()
    await page.getByRole('button', { name: 'Mark installment 1 paid' }).click()
    await page.getByRole('button', { name: 'Record payment' }).click()
    await expect(page.getByText('1 of 3 paid')).toBeVisible()
    await page.getByRole('button', { name: 'Undo installment 1' }).click()
    await page.getByRole('button', { name: 'Mark unpaid', exact: true }).click()
    await expect(page.getByText('0 of 3 paid')).toBeVisible()
  })
})

test.describe('backup and restore', () => {
  test('restore shows a preview with counts before replacing data, then reports what was imported', async ({ page }) => {
    await login(page)
    await page.goto('/settings')
    await page.locator('#restore-file').setInputFiles(path.join(__dirname, '..', '..', 'tests', 'fixtures', 'backup-v3.0.json'))
    const dialog = page.getByRole('dialog', { name: 'Replace your data with this backup?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Backup version 3.0')).toBeVisible()
    await expect(dialog.getByText('Accounts')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.locator('#restore-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"spendwise-backup","accounts":[') })
    await expect(page.getByText(/not valid JSON|cut off/)).toBeVisible()
    await page.locator('#restore-file').setInputFiles(path.join(__dirname, '..', '..', 'tests', 'fixtures', 'backup-v3.0.json'))
    await page.getByRole('button', { name: 'Replace my data' }).click()
    await expect(page.getByText(/Backup restored successfully: 4 accounts, 3 cards/)).toBeVisible()
  })
})

test.describe('accessibility and responsive layout', () => {
  const pages = ['/dashboard', '/payments', '/accounts?section=banks', '/accounts?section=cards', '/accounts?section=recurring', '/accounts?section=loans', '/income', '/settings']

  for (const url of pages) {
    test(`${url}: no horizontal overflow and no serious accessibility violations`, async ({ page }) => {
      await login(page)
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')
      expect(serious.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
    })
  }

  for (const url of ['/dashboard', '/payments', '/accounts?section=loans', '/settings']) {
    test(`${url}: dark mode has no serious accessibility violations`, async ({ page }) => {
      await login(page)
      await page.evaluate(() => localStorage.setItem('theme', 'dark'))
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('html')).toHaveClass(/dark/)
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')
      expect(serious.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
    })
  }

  test('sheets are dialogs: labelled, Escape closes, focus returns to the trigger, Tab stays inside', async ({ page }) => {
    await login(page)
    await page.goto('/accounts?section=banks')
    const trigger = page.getByRole('button', { name: 'Add account' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Add account' })
    await expect(dialog).toBeVisible()
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('every icon-only button has an accessible name', async ({ page }) => {
    await login(page)
    for (const url of ['/accounts?section=recurring', '/accounts?section=loans', '/accounts?section=cards', '/income']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      const unnamed = await page.$$eval('button', buttons => buttons.filter(button => !(button.textContent || '').trim() && !button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby')).length)
      expect(unnamed, url).toBe(0)
    }
  })
})
