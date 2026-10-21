// Browser end-to-end test of the real UI at http://localhost:8080 (headless Chrome).
// Usage: node ui-test.js <screenshotDir>  (needs ADMIN_EMAIL / ADMIN_PASSWORD; CHROME_PATH optional)
const puppeteer = require('puppeteer-core');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const OUT = process.argv[2] || '.';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const results = [];
const problems = [];

function check(name, ok, info = '') {
  results.push({ name, ok: Boolean(ok), info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ` — ${info}` : ''}`);
}

// Sets a React-controlled input's value and fires the input event.
async function setValue(page, selector, value) {
  await page.waitForSelector(selector);
  await page.$eval(
    selector,
    (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const text = (page) => page.evaluate(() => document.body.innerText);
const noHorizontalScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    // 4xx responses from the intentional negative tests (409 duplicate, 404 missing, 401 wrong password) are expected
    if (msg.type() === 'error' && !/favicon|Failed to load resource/i.test(msg.text())) {
      problems.push(`console: ${msg.text()}`);
    }
  });
  const stamp = Date.now();
  const email = `ui.visitor.${stamp}@example.com`;

  try {
    // ---------- Public: home (desktop) ----------
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.waitForSelector('a[href^="/events/"] h3');
    const cards = await page.$$eval('#events a[href^="/events/"]', (a) => a.length);
    check('U1 home shows event cards', cards >= 6, `${cards} cards`);
    const body = await text(page);
    check('U2 hero + next-up card render', body.includes('showing up') && body.includes('NEXT UP'));
    check('U3 sold-out badge visible on full event', /SOLD OUT/i.test(body));
    const searchRow = await page.evaluate(() => {
      const form = document.querySelector('form[role="search"]');
      const tops = [...form.children].map((el) => Math.round(el.getBoundingClientRect().top));
      return new Set(tops).size === 1;
    });
    check('U3b desktop search bar fits on one row (Search button not wrapped)', searchRow);
    const nextUp = await page.$eval('aside[aria-label="Next event"]', (el) => el.innerText);
    check('U3c "Next up" card features an event that still has seats', !/Seats left\s*0\b/.test(nextUp));
    await shot(page, '01-home-desktop');

    await page.click('button[aria-pressed]::-p-text(Workshop)');
    await page.waitForFunction(() => location.search.includes('category=Workshop'));
    await page.waitForFunction(() => !document.querySelector('#events [aria-hidden="true"].skeleton'));
    await new Promise((r) => setTimeout(r, 600));
    const workshopCards = await page.$$eval('#events a[href^="/events/"]', (a) => a.length);
    check('U4 category chip filters the grid', workshopCards > 0 && workshopCards < cards, `${workshopCards} workshop cards`);

    await page.goto(`${BASE}/?q=zzzz-no-match`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('::-p-text(No events match your filters)');
    check('U5 empty state for a search with no results', true);

    // ---------- Public: home (phone) ----------
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.waitForSelector('a[href^="/events/"] h3');
    check('U6 phone layout has no horizontal scroll', await noHorizontalScroll(page));
    check('U7 phone shows menu button', Boolean(await page.$('button[aria-label="Open menu"]')));
    await shot(page, '02-home-phone');

    // ---------- Event details + registration ----------
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/events/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[autocomplete="name"]');
    await shot(page, '03-event-details');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]');
    const errs = await page.$$eval('[role="alert"]', (n) => n.map((x) => x.textContent));
    check('U8 empty form shows field errors', errs.length >= 3, errs.join(' | '));

    await setValue(page, 'input[autocomplete="name"]', 'UI Test Visitor');
    await setValue(page, 'input[autocomplete="email"]', email);
    await setValue(page, 'input[autocomplete="tel"]', '+92 300 7654321');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname.endsWith('/registered'), { timeout: 10000 });
    const code = new URL(page.url()).searchParams.get('code');
    check('U9 registration goes to confirmation with code', /^EVT-[A-Z2-9]{6}$/.test(code), code);
    const conf = await text(page);
    check('U10 confirmation shows name, code and event', conf.includes("You're in, UI!") && conf.includes(code) && conf.includes(email));
    await page.waitForSelector('[data-sonner-toast]');
    check('U11 success toast appears', true);
    await shot(page, '04-confirmation');

    await page.goto(`${BASE}/events/1`, { waitUntil: 'networkidle0' });
    await setValue(page, 'input[autocomplete="name"]', 'UI Test Visitor');
    await setValue(page, 'input[autocomplete="email"]', email.toUpperCase());
    await setValue(page, 'input[autocomplete="tel"]', '+92 300 7654321');
    await page.click('button[type="submit"]');
    await page.waitForSelector('::-p-text(already registered for this event)');
    check('U12 duplicate email shows friendly error', true);
    await shot(page, '05-duplicate-error');

    await page.goto(`${BASE}/events/7`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('::-p-text(Registration closed)');
    check('U13 full event shows Sold out and closed form', !(await page.$('input[autocomplete="email"]')));
    await shot(page, '06-sold-out');

    await page.goto(`${BASE}/events/99999`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('::-p-text(Event not found)');
    check('U14 missing event shows friendly error', true);

    // ---------- Admin ----------
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/admin/login');
    check('U15 /admin redirects to login when signed out', true);
    await setValue(page, 'input[type="email"]', process.env.ADMIN_EMAIL);
    await setValue(page, '#password', 'definitely-wrong');
    await page.click('button[type="submit"]');
    await page.waitForSelector('::-p-text(Email or password is incorrect)');
    check('U16 wrong password shows error', true);
    await setValue(page, '#password', process.env.ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname === '/admin', { timeout: 10000 });
    await page.waitForSelector('::-p-text(Registrations per event)');
    await page.waitForSelector('.recharts-bar-rectangle');
    const dash = await text(page);
    check('U17 dashboard shows stats and chart', dash.includes('Total events') && dash.includes('Total registrations') && dash.includes('Upcoming events'));
    await shot(page, '07-dashboard');

    await page.goto(`${BASE}/admin/events/new`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('::-p-aria(Title)');
    const title = `UI Created Event ${stamp}`;
    await setValue(page, '::-p-aria(Title)', title);
    await setValue(page, '::-p-aria(Category)', 'Webinar');
    await setValue(page, '::-p-aria(Location)', 'Online');
    await setValue(page, '::-p-aria(Description)', 'An event created through the admin UI by the browser test.');
    const local = new Date(Date.now() + 10 * 864e5);
    const pad = (n) => String(n).padStart(2, '0');
    await setValue(page, '::-p-aria(Date and time)', `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T18:30`);
    await setValue(page, '::-p-aria(Capacity)', '75');
    const preview = await text(page);
    check('U18 live preview updates while typing', preview.includes(title) && preview.includes('75 of 75 seats left'));
    await shot(page, '08-event-form');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname === '/admin/events', { timeout: 10000 });
    await page.waitForSelector(`::-p-text(${title})`);
    check('U19 admin creates event through the UI', true);
    await shot(page, '09-admin-events');

    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await setValue(page, 'input[type="search"]', `UI Created Event ${stamp}`);
    await page.waitForSelector(`::-p-text(${title})`, { timeout: 10000 });
    check('U20 new event appears on the public homepage', true);

    await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle0' });
    await page.click(`button[aria-label="Delete ${title}"]`);
    await page.waitForSelector('dialog[open]');
    check('U21 delete asks for confirmation', (await text(page)).includes('This also deletes all of its registrations'));
    await page.click('dialog[open] button::-p-text(Delete event)');
    await page.waitForFunction((t) => !document.body.innerText.includes(`Delete “${t}”`) && !document.querySelector('dialog[open]'), {}, title);
    await page.waitForFunction((t) => !document.querySelector(`button[aria-label="Delete ${t}"]`), {}, title);
    check('U22 event deleted after confirming', true);

    await page.goto(`${BASE}/admin/registrations?event=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector(`::-p-text(${email})`);
    check('U23 registrations page lists the visitor', (await text(page)).includes(code));
    const client = await page.createCDPSession();
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });
    await page.click('button::-p-text(Export CSV)');
    await page.waitForSelector('::-p-text(CSV downloaded)', { timeout: 10000 });
    check('U24 Export CSV downloads and shows toast', true);
    await shot(page, '10-registrations');

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('::-p-text(Registrations per event)');
    check('U25 admin dashboard fits a phone screen', await noHorizontalScroll(page));
    await shot(page, '11-dashboard-phone');

    await page.click('button[aria-label="Open menu"]');
    await page.click('header button::-p-text(Log out)');
    await page.waitForFunction(() => location.pathname === '/admin/login');
    check('U26 log out returns to login', true);
  } catch (err) {
    check('UNEXPECTED ERROR', false, err.message.split('\n')[0]);
    await shot(page, 'zz-failure').catch(() => {});
  }

  check('U27 no JavaScript errors in the browser console', problems.length === 0, problems.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`TOTAL pass=${results.length - failed} fail=${failed}`);
  process.exit(failed ? 1 : 0);
})();
