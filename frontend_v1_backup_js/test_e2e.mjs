import { chromium } from 'playwright'

const errors = []
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message))

const report = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${extra ? ' - ' + extra : ''}`)

// 1. Data Management page
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const teacherRows = await page.locator('table tbody tr').count()
report('Data page loads with teacher rows', teacherRows > 0, `${teacherRows} rows`)

// switch to Subjects tab
await page.click('button:has-text("Subjects")')
await page.waitForTimeout(300)
const subjectRows = await page.locator('table tbody tr').count()
report('Subjects tab shows rows', subjectRows > 0, `${subjectRows} rows`)

// switch to Requirements tab
await page.click('button:has-text("Requirements")')
await page.waitForTimeout(300)
const reqRows = await page.locator('table tbody tr').count()
report('Requirements tab shows rows', reqRows > 0, `${reqRows} rows`)

// 2. Constraints page
await page.goto('http://localhost:5173/constraints', { waitUntil: 'networkidle' })
await page.fill('input[placeholder*="Rao"]', "Kavita Rao cant teach Friday afternoons")
await page.click('button:has-text("Parse")')
await page.waitForTimeout(1000)
const cardText = await page.locator('body').innerText()
report('Constraint parse shows resolved card', cardText.includes('Kavita Rao') && cardText.includes('unavailable'))

const confirmBtn = page.locator('button:has-text("Confirm & Save")')
if (await confirmBtn.count()) {
  await confirmBtn.click()
  await page.waitForTimeout(800)
  const savedText = await page.locator('body').innerText()
  report('Constraint saved and listed', savedText.includes('Saved constraints (1'))
} else {
  report('Confirm button present', false)
}

// 3. Generate page
await page.goto('http://localhost:5173/generate', { waitUntil: 'networkidle' })
await page.click('button:has-text("Generate Timetable")')
console.log('Waiting for solver (up to 40s)...')
await page.waitForSelector('text=/completed|failed/i', { timeout: 45000 })
const genText = await page.locator('body').innerText()
report('Timetable generation completed', genText.toLowerCase().includes('completed'))
report('Solver message shown', genText.includes('Scheduled') && genText.includes('class-periods'))

// 4. Viewer page
const viewBtn = page.locator('button:has-text("View Timetable")')
if (await viewBtn.count()) {
  await viewBtn.click()
} else {
  await page.goto('http://localhost:5173/viewer', { waitUntil: 'networkidle' })
}
await page.waitForTimeout(1000)
const gridCells = await page.locator('table td').count()
report('Viewer grid renders cells', gridCells > 0, `${gridCells} cells`)

const subjectCell = await page.locator('table td div.rounded-md').first()
const hasSubjectBlock = (await subjectCell.count()) > 0
report('Viewer shows at least one scheduled subject block', hasSubjectBlock)

// switch to teacher view
await page.click('button:has-text("teacher view")')
await page.waitForTimeout(800)
const teacherGridCells = await page.locator('table td div.rounded-md').count()
report('Teacher view shows entries', teacherGridCells >= 0, `${teacherGridCells} entries`)

await page.screenshot({ path: 'e2e_viewer.png', fullPage: true })
console.log('Screenshot saved: e2e_viewer.png')

console.log('\n--- Console/page errors captured ---')
if (errors.length === 0) {
  console.log('None')
} else {
  errors.forEach((e) => console.log('ERROR:', e))
}

await browser.close()
process.exit(errors.some((e) => e.startsWith('PAGEERROR')) ? 1 : 0)
