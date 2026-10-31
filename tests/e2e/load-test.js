// Small load test that demonstrates ECS auto scaling on the live site.
// Requests Nginx's own /healthz (no database load, not rate limited) so the ALB's
// "requests per target" scaling policy fires. Usage: node load-test.js <url> <minutes> [concurrency]
const [, , url, minutes = '7', concurrency = '30'] = process.argv;
const end = Date.now() + Number(minutes) * 60000;
let ok = 0;
let failed = 0;

async function worker() {
  while (Date.now() < end) {
    try {
      const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(10000) });
      await res.arrayBuffer();
      if (res.ok) ok += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
}

const timer = setInterval(() => {
  console.log(`${new Date().toISOString()} requests ok=${ok} failed=${failed} (${Math.round(ok / 2)}/min last interval)`);
}, 30000);
let last = 0;
const rate = setInterval(() => {
  last = ok;
}, 30000);

Promise.all(Array.from({ length: Number(concurrency) }, worker)).then(() => {
  clearInterval(timer);
  clearInterval(rate);
  console.log(`FINISHED total ok=${ok} failed=${failed} last=${last}`);
});
