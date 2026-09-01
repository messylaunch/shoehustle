// End-to-end smoke test: create the shop, price a pair, add comps, list it,
// and check it shows up on the public storefront.
//
// Server actions redirect, so every assertion polls for the expected text
// rather than reading the DOM straight after a click.
import { chromium } from "playwright";

// Point BASE at a running instance; SMOKE_OUT is where screenshots land.
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3100";
const OUT = process.env.SMOKE_OUT ?? "/tmp";

let passed = 0;

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

/** Waits for text to appear anywhere on the page, then records a pass. */
async function expectText(pattern, label) {
  await page.waitForFunction(
    (src) => new RegExp(src, "i").test(document.body.innerText),
    pattern,
    { timeout: 15000 },
  );
  passed++;
  console.log("OK ", label);
}

async function expectUrl(glob, label) {
  await page.waitForURL(glob, { timeout: 15000 });
  passed++;
  console.log("OK ", label);
}

/** Exact match on one element's text, so a substring elsewhere can't pass it. */
async function expectExact(selector, want, label) {
  await page.waitForSelector(selector, { timeout: 15000 });
  const got = (await page.textContent(selector))?.trim();
  if (got !== want) {
    throw new Error(`${label}: expected "${want}" in ${selector}, got "${got}"`);
  }
  passed++;
  console.log("OK ", label);
}

try {
  // 1. First run pushes you to setup.
  await page.goto(`${BASE}/login`);
  await expectUrl("**/setup", "fresh install redirects to setup");

  // 2. Create the shop.
  await page.fill('input[name="name"]', "Mike");
  await page.fill('input[name="email"]', "mike@example.com");
  await page.fill('input[name="password"]', "hustle12345");
  await page.click('form:has(input[name="password"]) button[type="submit"]');
  await expectUrl("**/app/guide", "account created, lands on the guide");
  await page.screenshot({ path: `${OUT}/shot-guide.png` });

  // 3. Price a pair by hand (no API key in this environment).
  await page.goto(`${BASE}/app/price`);
  await page.fill("#brand", "Jordan");
  await page.fill("#model", "4 Retro");
  await page.fill("#colorway", "Military Black");
  await page.fill("#styleCode", "DH6927-111");
  await page.fill("#retail", "210");
  await page.fill("#size", "10.5");
  await page.selectOption("#grade", "G8");
  await page.fill("#cost", "23");
  await page.fill("#acquiredFrom", "Josh");
  // Scope to the form: the topbar's "Sign out" is also a submit button.
  await page.click('form:has(#brand) button[type="submit"]');
  await expectUrl("**/app/inventory/**", "pair saved, lands on its workbench");

  // With no comps it falls back to retail x grade multiplier and says so.
  await expectText(
    "rule-of-thumb",
    "discloses that the estimate is a rule of thumb, not comps",
  );
  // Retail $210 x 0.5 for an 8/10 = $105 as-is, so $23 is comfortably under.
  await expectExact(".verdict h2", "Good buy", "verdict rendered off retail");

  // 4. Add two real sold comps at this grade.
  for (const price of ["60", "70"]) {
    await page.fill('form:has(input[name="price"]) input[name="price"]', price);
    await page.selectOption('form:has(input[name="price"]) select[name="kind"]', "SOLD");
    await page.selectOption('form:has(input[name="price"]) select[name="grade"]', "G8");
    await page.click('form:has(input[name="price"]) button[type="submit"]');
    await page.waitForFunction(
      (want) =>
        document.querySelectorAll("table tbody tr").length >= want,
      Number(price) === 60 ? 1 : 2,
      { timeout: 15000 },
    );
  }
  passed++;
  console.log("OK  added two sold comps");

  await expectText(
    "Median of 2 sold comps",
    "estimate switched to the median of sold comps at grade",
  );
  // Median of $60 and $70 is $65 as-is. Restoring lifts that to $104
  // (0.8/0.5 of the 8/10 multiplier), which nets $92.56 on Whatnot's 11%,
  // less $12 shipping, $18 of work and a $30 target profit = $32.56.
  await expectExact(".verdict h2", "Good buy", "still a buy on real comps");
  await expectExact(
    ".lane.best .lane-max",
    "$32.56",
    "restore lane ceiling matches the arithmetic",
  );
  await page.screenshot({ path: `${OUT}/shot-workbench.png`, fullPage: true });

  // 5. List it.
  await page.fill('form:has(select[name="status"]) input[name="listPrice"]', "85");
  await page.selectOption('form:has(select[name="status"]) select[name="status"]', "LISTED");
  await page.click('form:has(select[name="status"]) button[type="submit"]');
  await expectText("Saved", "pair listed");

  // 6. Storefront.
  await page.goto(BASE);
  await expectText("Jordan 4 Retro Military Black", "pair is live on the shop");
  await expectText("\\$85\\.00", "price shows on the shop");
  await page.screenshot({ path: `${OUT}/shot-shop.png` });

  await page.click('a.size-chip:has-text("10.5")');
  await expectText("Size 10\\.5", "size filter works");

  // 7. Item page.
  await page.click("a.shoe-card");
  await expectText("Message me to buy|Buy —", "item page offers a buy path");
  await page.screenshot({ path: `${OUT}/shot-item.png` });

  // 8. Size alert capture.
  await page.goto(BASE);
  await page.fill("#alert-email", "buyer@example.com");
  await page.fill("#alert-size", "10.5");
  await page.click('form:has(#alert-email) button[type="submit"]');
  await expectText("You're on the list", "size alert captured");

  // 9. That alert should be flagged against stock we already hold.
  await page.goto(`${BASE}/app/leads`);
  await expectText(
    "waiting on a size you have in stock",
    "leads page matches the alert against stock",
  );
  await page.screenshot({ path: `${OUT}/shot-leads.png` });

  // 10. Restoration intake.
  await page.goto(`${BASE}/restoration`);
  await page.fill("#r-name", "Dana");
  await page.fill("#r-email", "dana@example.com");
  await page.fill("#r-shoe", "Air Force 1, size 9");
  await page.fill("#r-condition", "Midsoles gone yellow");
  await page.click('form:has(#r-name) button[type="submit"]');
  await expectText("Got it", "restoration enquiry submitted");

  // 11. Remaining seller pages render.
  for (const path of [
    "/app",
    "/app/playbook",
    "/app/settings",
    "/app/sellers",
    "/app/orders",
    "/app/inventory",
  ]) {
    const res = await page.goto(`${BASE}${path}`);
    if (!res || res.status() >= 400) {
      throw new Error(`${path} returned ${res?.status()}`);
    }
  }
  passed++;
  console.log("OK  every seller page renders");
  await page.goto(`${BASE}/app/playbook`);
  await page.screenshot({ path: `${OUT}/shot-playbook.png` });

  console.log(`\nSMOKE TEST PASSED — ${passed} checks`);
} catch (error) {
  console.error("\nFAILED:", error.message);
  console.error("last url:", page.url());
  await page.screenshot({ path: `${OUT}/shot-error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
