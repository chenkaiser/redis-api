/**
 * Leaky Bucket Rate Limiter — middleware test
 *
 * Run:  node test-rate-limiter.mjs
 *
 * The rate limiter is now middleware applied to all routes.
 * Requests are keyed by the client IP, so plain GET /redis calls
 * are automatically throttled — no special endpoint needed.
 *
 * What to expect:
 *   Phase 1 – 15 rapid requests. The first 10 (= capacity) are allowed;
 *              the rest are rejected with 429 by the middleware.
 *   Phase 2 – wait for the bucket to drain (capacity / leakRate seconds).
 *   Phase 3 – 5 more requests, all allowed again.
 */

const BASE      = 'http://localhost:3000';
const URL       = `${BASE}/redis/probe-key`;   // any /redis route triggers middleware

// Must match the constants in rate-limiter.middleware.ts
const CAPACITY  = 10;
const LEAK_RATE = 2;   // req/s

let seq = 0;

async function hit() {
  const n   = ++seq;
  const res = await fetch(URL);
  const body = await res.json().catch(() => ({}));

  const label = res.ok ? '✅ ALLOWED' : '❌ DENIED (429)';
  // Denied responses carry `level` from the middleware; allowed ones don't.
  const level = typeof body.level === 'number' ? body.level.toFixed(3) : '—';

  console.log(`  [${String(n).padStart(2, '0')}] ${label}  level=${level}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

console.log('═══════════════════════════════════════════════════════');
console.log(' Leaky Bucket Rate Limiter — middleware mode');
console.log(`   route      : GET ${URL}`);
console.log(`   capacity   : ${CAPACITY}  (max requests in flight)`);
console.log(`   leak rate  : ${LEAK_RATE} req/s`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Phase 1: burst ───────────────────────────────────────────────────────────
console.log(`Phase 1 — burst of 15 requests (expect first ${CAPACITY} allowed, rest denied)\n`);
for (let i = 0; i < 15; i++) await hit();

// ── Phase 2: drain ───────────────────────────────────────────────────────────
const drainSec = CAPACITY / LEAK_RATE + 1;
console.log(`\nPhase 2 — waiting ${drainSec}s for bucket to fully drain…\n`);
await sleep(drainSec * 1000);

// ── Phase 3: recover ─────────────────────────────────────────────────────────
console.log(`Phase 3 — 5 requests after drain (all should be allowed)\n`);
for (let i = 0; i < 5; i++) await hit();

console.log('\n✓ Test complete.');
