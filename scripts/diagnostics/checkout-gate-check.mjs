/**
 * Photographs checkout: the sign-in gate a guest meets, and the details form
 * behind it.
 *
 *   SHOT_DIR=/tmp/shots node scripts/diagnostics/checkout-gate-check.mjs
 *
 * Separate from visual-check.mjs because checkout cannot be photographed
 * without a cart, and a cart lives in localStorage — so this seeds one first.
 * Read-only otherwise: it fills no form and places no order.
 */
import { chromium } from 'playwright';

const OUT = process.env.SHOT_DIR;
const browser = await chromium.launch();
const problems = [];

for (const [label, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  page.on('console', (m) => m.type() === 'error' && problems.push(`[${label}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[${label}] ${e.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem(
      'gidiammini_cart',
      JSON.stringify([
        {
          productId: 'd906aa13-8662-499b-90cf-eb4b57e10dd6',
          name: 'Pickard Bracelet',
          price: 5000,
          quantity: 1,
          image: '',
          size: 'S',
          color: 'Multicolour',
        },
      ])
    );
  });

  await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${label}-checkout-gate.png`, fullPage: true, caret: 'initial' });
  console.log(`shot ${label}-checkout-gate`);

  const guest = page.getByRole('button', { name: /continue as guest/i });
  if (await guest.count()) {
    await guest.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${label}-checkout-form.png`, fullPage: true, caret: 'initial' });
    console.log(`shot ${label}-checkout-form`);
  } else {
    problems.push(`[${label}] no "continue as guest" button on the gate`);
  }

  await page.close();
}

await browser.close();
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo console or page errors.');
