// Renders the real AWS CLI output in docs/evidence/cli/*.txt to terminal-style PNGs
// (docs/evidence/cli-images), so the report can show them as figures.
// Nothing is mocked: each image is the saved text of that command, unchanged.
//   node render-cli.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'docs', 'evidence', 'cli');
const OUT = path.join(ROOT, 'docs', 'evidence', 'cli-images');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MAX_LINES = 60;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.txt'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 400, deviceScaleFactor: 2 });

  for (const file of files) {
    let lines = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').replace(/^\uFEFF/, '').split('\n');
    if (/^terraform-/.test(file)) lines = lines.filter((l) => /Apply complete|^Plan:/.test(l)); // summary lines only
    if (lines.length > MAX_LINES) lines = [...lines.slice(0, 8), `... (${lines.length - MAX_LINES + 8} lines omitted, full file: docs/evidence/cli/${file}) ...`, ...lines.slice(-(MAX_LINES - 9))];
    await page.setContent(`<html><body style="margin:0;background:#0d1117"><pre style="margin:0;padding:16px 18px;font:13px/1.45 Consolas,monospace;color:#e6edf3;white-space:pre-wrap;word-break:break-word">${esc(lines.join('\n').trimEnd())}</pre></body></html>`);
    const height = await page.evaluate(() => Math.ceil(document.querySelector('pre').getBoundingClientRect().height));
    await page.screenshot({ path: path.join(OUT, file.replace(/\.txt$/, '.png')), clip: { x: 0, y: 0, width: 1100, height: Math.max(height, 40) } });
  }
  await browser.close();
  console.log(`Rendered ${files.length} files to docs/evidence/cli-images`);
})();
