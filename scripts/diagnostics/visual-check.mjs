/**
 * Visual check of the storefront and admin surfaces against the running dev
 * server: screenshots each at desktop and mobile width, and reports any console
 * or page error it saw.
 *
 * Read-only. It loads pages and opens drawers and forms; it submits nothing, so
 * it writes no rows to whatever database the dev server is pointed at.
 *
 * It mints an admin session token from JWT_SECRET so the admin pages can be
 * photographed without a password. That is why it refuses any host but
 * localhost — a minted token belongs nowhere near a deployed environment.
 *
 * Usage:  SHOT_DIR=/tmp/shots node scripts/diagnostics/visual-check.mjs <product-id>
 */
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SHOT_DIR;

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}. This script mints an admin token, so it only talks to localhost.`);
  process.exit(1);
}

if (!OUT) {
  console.error('Set SHOT_DIR to a directory for the screenshots.');
  process.exit(1);
}

const b64 = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

/** The same HS256 token the login route issues, minted locally so the admin
 *  pages can be viewed without a password. */
function adminToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    role: 'admin',
    email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
    exp: Date.now() + 60 * 60 * 1000,
  });
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const productId = process.argv[2];
const problems = [];

const browser = await chromium.launch();

async function shoot(page, name, fullPage = true) {
  // caret: 'initial' — the default ('hide') injects caret-color:transparent
  // into every input, which React reports as a hydration mismatch. That is the
  // screenshot tool's artefact, not the page's bug.
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, caret: 'initial' });
  console.log(`shot ${name}`);
}

for (const [label, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport });
  const token = adminToken();
  if (token) {
    await context.addCookies([
      { name: 'admin-token', value: token, domain: 'localhost', path: '/' },
    ]);
  }

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`));

  // Storefront: the product page, then the size guide open.
  await page.goto(`${BASE}/products/${productId}`, { waitUntil: 'networkidle' });
  await shoot(page, `${label}-product`);

  const guide = page.getByRole('button', { name: /size guide/i });
  if (await guide.count()) {
    await guide.first().click();
    await page.waitForTimeout(400);
    await shoot(page, `${label}-size-guide`, false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } else {
    problems.push(`[${label}] no size guide button on the product page`);
  }

  // The Q&A section with the ask form open.
  const ask = page.getByRole('button', { name: /ask a question/i });
  if (await ask.count()) {
    await ask.first().scrollIntoViewIfNeeded();
    await ask.first().click();
    await page.waitForTimeout(300);
    await shoot(page, `${label}-ask-question`);
  } else {
    problems.push(`[${label}] no ask-a-question button`);
  }

  // The signed-out account pages. The signed-in views need a real session row,
  // so they are deliberately not exercised here — this script writes nothing.
  for (const [name, path] of [
    ['account-login', '/account/login'],
    ['account-verify', `/account/verify?token=${'x'.repeat(43)}`],
    ['account-signed-out', '/account'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(800);
    await shoot(page, `${label}-${name}`);
  }

  // Admin surfaces.
  for (const [name, path] of [
    ['admin-reviews', '/admin/reviews'],
    ['admin-questions', '/admin/questions'],
    ['admin-categories', '/admin/categories'],
    ['admin-product-new', '/admin/products/new'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Not networkidle: the admin polls its alert ticker, so it never idles.
    await page.waitForSelector('h1', { timeout: 60000 }).catch(() =>
      problems.push(`[${label}] ${path} rendered no h1`)
    );
    // These queues fire four queries at a database in another continent, so
    // waiting a fixed second photographs a spinner. Wait for it to go, and
    // report how long it took — that number is the page's real first paint.
    const started = Date.now();
    await page
      .locator('text=/Loading /')
      .waitFor({ state: 'detached', timeout: 60000 })
      .catch(() => problems.push(`[${label}] ${path} still loading after 60s`));
    const waited = Date.now() - started;
    if (waited > 1500) console.log(`  ${path} settled in ${(waited / 1000).toFixed(1)}s`);
    await page.waitForTimeout(400);
    if (page.url().includes('/admin/login')) problems.push(`[${label}] ${path} redirected to login`);
    await shoot(page, `${label}-${name}`);
  }

  await context.close();
}

await browser.close();

console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo console or page errors.');
