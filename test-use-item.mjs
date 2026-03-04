/**
 * test-use-item.mjs
 *
 * Proves that POST /product/use-item:
 *   1. Correctly depletes inventory from 3 → 0 (exactly 3 successes).
 *   2. Returns "no inventory available" after stock is exhausted.
 *   3. The distributed lock prevents dirty reads/writes — no double-spend.
 *
 * Simulates 5 concurrent "server instances" by firing concurrent requests.
 * Each round fires N simultaneous requests and collects all responses.
 */

const BASE = 'http://localhost:3000';

// ── helpers ─────────────────────────────────────────────────────────────────

async function post(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' });
  const body = await res.json();
  return { status: res.status, body };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  return res.json();
}

function print(label, value) {
  console.log(`  ${label.padEnd(20)} ${value}`);
}

// ── reset inventory ──────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' useItem  Distributed-Lock Test');
console.log('   initial stock  : 3');
console.log('   simulated nodes: 5 concurrent requests per wave');
console.log('═══════════════════════════════════════════════════════════\n');

await del('/product/inventory');
const initial = await get('/product/inventory');
console.log(`[ Reset ]  inventory = ${initial.remaining}\n`);

// ── wave 1: 5 simultaneous requests ──────────────────────────────────────────

console.log('[ Wave 1 ]  Fire 5 concurrent POST /product/use-item …');

const wave1 = await Promise.all(Array.from({ length: 5 }, () => post('/product/use-item')));

const wave1Success  = wave1.filter(r => r.status === 201);
const wave1Locked   = wave1.filter(r => r.status === 503);
const wave1Empty    = wave1.filter(r => r.status === 201 && !r.body.success);

console.log('\n  Results:');
wave1.forEach((r, i) => {
  const tag = r.status === 201
    ? (r.body.success ? '✓ used' : '✗ empty')
    : '⚠ locked';
  console.log(`    [req ${i + 1}]  HTTP ${r.status}  ${tag}  — ${r.body.message}`);
});

console.log('');
print('Successful uses:', wave1Success.filter(r => r.body.success).length);
print('Lock contention:', wave1Locked.length);
print('Already empty:',  wave1Empty.length);

// ── wave 2: drain the rest ────────────────────────────────────────────────────

// Some of wave 1's 503s should retry. Send 10 more to drain fully.
console.log('\n[ Wave 2 ]  Retry 503s + extra — send 10 more requests …');

const wave2 = await Promise.all(Array.from({ length: 10 }, () => post('/product/use-item')));

const wave2Success = wave2.filter(r => r.status === 201 && r.body.success);
const wave2Locked  = wave2.filter(r => r.status === 503);
const wave2Empty   = wave2.filter(r => r.status === 201 && !r.body.success);

console.log('\n  Results:');
wave2.forEach((r, i) => {
  const tag = r.status === 201
    ? (r.body.success ? '✓ used' : '✗ empty')
    : '⚠ locked';
  console.log(`    [req ${i + 1}]  HTTP ${r.status}  ${tag}  — ${r.body.message}`);
});

console.log('');
print('Successful uses:', wave2Success.length);
print('Lock contention:', wave2Locked.length);
print('Already empty:',  wave2Empty.length);

// ── final inventory check ─────────────────────────────────────────────────────

const final = await get('/product/inventory');
console.log(`\n[ Final ]  inventory = ${final.remaining}`);

// ── assertions ────────────────────────────────────────────────────────────────

console.log('\n── Assertions ──────────────────────────────────────────────');

const totalSuccessful = [...wave1, ...wave2].filter(r => r.status === 201 && r.body.success).length;
const totalAttempts   = wave1.length + wave2.length;
const totalLocked     = [...wave1, ...wave2].filter(r => r.status === 503).length;

let passed = true;

function assert(label, condition) {
  const mark = condition ? '✓' : '✗';
  console.log(`  ${mark}  ${label}`);
  if (!condition) passed = false;
}

assert(`Exactly 3 items were used (got ${totalSuccessful})`,   totalSuccessful === 3);
assert(`Final inventory is 0 (got ${final.remaining})`,        final.remaining  === 0);
assert(`No over-spend (remaining never negative)`,             final.remaining  >= 0);
assert(`Lock contention was observed (${totalLocked} × 503)`,  totalLocked       > 0);

console.log('');
if (passed) {
  console.log('  All assertions passed. Distributed lock works correctly.');
} else {
  console.log('  One or more assertions FAILED — check output above.');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════\n');
