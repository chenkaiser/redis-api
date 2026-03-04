/**
 * Rate Limiter Benchmark — completion-parity comparison
 *
 * Run:  node test-benchmark.mjs
 *
 * Both rounds must successfully handle all REQUESTS.
 *
 * Round 1 — GET /ping  (no rate limit)
 *   All REQUESTS fired at once; all complete in one shot.
 *
 * Round 2 — GET /redis/probe  (leaky bucket)
 *   Requests are sent in batches. 429s are counted and re-queued.
 *   The clock keeps running until every one of the REQUESTS has been
 *   served a 2xx — showing the real cost of throttling.
 *
 * With capacity=100 and leakRate=50 req/s:
 *   - First batch: up to 100 pass immediately
 *   - Remaining 900: drained at 50/s → needs ~18 more seconds
 */

const BASE       = 'http://localhost:3000';
const REQUESTS   = 1000;
const CAPACITY   = 100;   // must match rate-limiter.middleware.ts CAPACITY
const LEAK_RATE  = 50;    // must match rate-limiter.middleware.ts LEAK_RATE

// Time (ms) between retry batches — just enough for the bucket to produce
// a useful number of free slots before we hammer it again.
const RETRY_INTERVAL_MS = 500;
const BATCH_SIZE        = Math.ceil(LEAK_RATE * (RETRY_INTERVAL_MS / 1000)) + 5;

const FLUSH_WAIT = Math.ceil(CAPACITY / LEAK_RATE + 1) * 1000;

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bar(done, total, width = 30) {
  const filled = Math.round((done / total) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

// ── Round 1: baseline ─────────────────────────────────────────────────────────

async function runBaseline(url) {
  const start = performance.now();
  const statuses = await Promise.all(
    Array.from({ length: REQUESTS }, () =>
      fetch(url).then(r => r.status).catch(() => 0),
    ),
  );
  const elapsed  = performance.now() - start;
  const allowed  = statuses.filter(s => s >= 200 && s < 400).length;

  console.log(`\n[ WITHOUT rate limiting ]  GET ${url}`);
  console.log(`  Total time   : ${elapsed.toFixed(0)} ms`);
  console.log(`  Throughput   : ${Math.round(REQUESTS / (elapsed / 1000))} req/s`);
  console.log(`  Completed    : ${allowed} / ${REQUESTS}`);

  return { elapsed, allowed };
}

// ── Round 2: rate-limited, retry until all succeed ───────────────────────────

async function runRateLimited(url) {
  const start    = performance.now();
  let   done     = 0;
  let   attempts = 0;
  let   batches  = 0;

  while (done < REQUESTS) {
    const need = REQUESTS - done;
    // Send slightly more than BATCH_SIZE to absorb some extra denials,
    // but never queue more work than actually needed.
    const send = Math.min(BATCH_SIZE * 2, need + BATCH_SIZE);

    const statuses = await Promise.all(
      Array.from({ length: send }, () =>
        fetch(url).then(r => r.status).catch(() => 0),
      ),
    );
    attempts += send;
    batches++;

    const ok = statuses.filter(s => s >= 200 && s < 400).length;
    done = Math.min(done + ok, REQUESTS);

    process.stdout.write(
      `\r  Progress  ${bar(done, REQUESTS)}  ${done}/${REQUESTS}  (batch #${batches}, ${attempts} total attempts)`,
    );

    if (done < REQUESTS) await sleep(RETRY_INTERVAL_MS);
  }

  const elapsed = performance.now() - start;
  console.log(); // newline after progress bar

  console.log(`\n[ WITH rate limiting    ]  GET ${url}`);
  console.log(`  Total time   : ${elapsed.toFixed(0)} ms`);
  console.log(`  Throughput   : ${Math.round(REQUESTS / (elapsed / 1000))} successful req/s`);
  console.log(`  Completed    : ${done} / ${REQUESTS}`);
  console.log(`  Total tries  : ${attempts}  (${attempts - REQUESTS} retries due to 429)`);
  console.log(`  Retry batches: ${batches}`);

  return { elapsed, done, attempts };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log(' Rate Limiter Benchmark  (completion-parity)');
console.log(`   target      : ${REQUESTS} successful responses each round`);
console.log(`   capacity    : ${CAPACITY} requests`);
console.log(`   leak rate   : ${LEAK_RATE} req/s`);
console.log(`   theory min  : ${((REQUESTS - CAPACITY) / LEAK_RATE).toFixed(1)}s for rate-limited round`);
console.log('═══════════════════════════════════════════════════════════');

const r1 = await runBaseline(`${BASE}/ping`);

console.log(`\n⏳ Flushing bucket (${FLUSH_WAIT / 1000}s)…`);
await sleep(FLUSH_WAIT);

const r2 = await runRateLimited(`${BASE}/redis/probe`);

// ── Summary ───────────────────────────────────────────────────────────────────
const slowdown = (r2.elapsed / r1.elapsed).toFixed(1);
console.log('\n───────────────────────────────────────────────────────────');
console.log(' Summary');
console.log(`  Without rate limit : ${r1.elapsed.toFixed(0)} ms   (${Math.round(REQUESTS/(r1.elapsed/1000))} req/s)`);
console.log(`  With rate limit    : ${r2.elapsed.toFixed(0)} ms   (${Math.round(REQUESTS/(r2.elapsed/1000))} successful req/s)`);
console.log(`  Slowdown           : ${slowdown}×  slower to complete the same work`);
console.log(`  Extra HTTP calls   : ${r2.attempts - REQUESTS}  (wasted on 429 retries)`);
console.log('═══════════════════════════════════════════════════════════\n');
