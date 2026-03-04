import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

// Atomically computes leaky bucket state.
// KEYS[1] = bucket key
// ARGV[1] = capacity, ARGV[2] = leak_rate (req/s), ARGV[3] = now (ms)
// Returns [allowed (0|1), level*1000 as integer]
// Releases a lock only when the caller's token matches (prevents a slow
// process from releasing a lock it no longer owns after TTL expiry).
// KEYS[1] = lock key   ARGV[1] = token
// Returns 1 if released, 0 if not owner
const RELEASE_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

// Auto-initialises the key to ARGV[1] if missing, then atomically
// decrements by 1 if the current value is > 0.
// KEYS[1] = inventory key   ARGV[1] = initial value (string)
// Returns new value (>= 0) on success, or -1 when already at 0
const CHECK_AND_DECREMENT_SCRIPT = `
  local val = redis.call('GET', KEYS[1])
  if not val then
    redis.call('SET', KEYS[1], ARGV[1])
    val = ARGV[1]
  end
  local n = tonumber(val)
  if n <= 0 then return -1 end
  return redis.call('DECR', KEYS[1])
`;

const LEAKY_BUCKET_SCRIPT = `
  local vals      = redis.call('HMGET', KEYS[1], 'level', 'last_time')
  local capacity  = tonumber(ARGV[1])
  local leak_rate = tonumber(ARGV[2])
  local now       = tonumber(ARGV[3])
  local level     = vals[1] and tonumber(vals[1]) or 0
  local last_time = vals[2] and tonumber(vals[2]) or now

  local elapsed_ms = now - last_time
  level = math.max(0, level - (elapsed_ms / 1000) * leak_rate)

  local allowed = 0
  if level + 1 <= capacity then
    level   = level + 1
    allowed = 1
  end

  local ttl = math.ceil(capacity / leak_rate) + 1
  redis.call('HSET', KEYS[1], 'level', level, 'last_time', now)
  redis.call('EXPIRE', KEYS[1], ttl)
  return { allowed, math.floor(level * 1000) }
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    @InjectPinoLogger(RedisService.name) private readonly logger: PinoLogger,
  ) {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  // Leaky bucket rate limiter.
  // Returns whether the request is allowed and the current fill level.
  async leakyBucket(
    identifier: string,
    capacity: number,
    leakRatePerSecond: number,
  ): Promise<{ allowed: boolean; level: number }> {
    const result = (await this.client.eval(
      LEAKY_BUCKET_SCRIPT,
      1,
      `leaky_bucket:${identifier}`,
      capacity,
      leakRatePerSecond,
      Date.now(),
    )) as [number, number];

    return { allowed: result[0] === 1, level: result[1] / 1000 };
  }

  // ── Distributed lock ───────────────────────────────────────────────────────

  // Tries once to acquire an exclusive lock. Returns a unique token on success
  // (needed to release), or null if the lock is already held. Callers are
  // responsible for retry logic.
  async acquireLock(resource: string, ttlMs = 300): Promise<string | null> {
    const token = randomUUID();
    const result = await this.client.set(resource, token, 'PX', ttlMs, 'NX');
    const acquired = result === 'OK';
    this.logger.debug({ resource, ttlMs, acquired }, 'acquireLock');
    return acquired ? token : null;
  }

  // Releases the lock only if the token matches (safe against expired locks).
  async releaseLock(resource: string, token: string): Promise<void> {
    await this.client.eval(RELEASE_LOCK_SCRIPT, 1, resource, token);
    this.logger.debug({ resource }, 'releaseLock');
  }

  // ── Inventory ──────────────────────────────────────────────────────────────

  // Increments the inventory key by 1. Used to roll back a failed decrement.
  async increment(key: string): Promise<void> {
    await this.client.incr(key);
    this.logger.debug({ key }, 'increment');
  }

  // Atomically decrements the inventory key.
  // Auto-initialises to `initialValue` if the key does not yet exist.
  // Returns the new count (>= 0), or -1 when already empty.
  async checkAndDecrement(key: string, initialValue: number): Promise<number> {
    const remaining = (await this.client.eval(
      CHECK_AND_DECREMENT_SCRIPT,
      1,
      key,
      String(initialValue),
    )) as number;
    this.logger.debug({ key, remaining }, 'checkAndDecrement');
    return remaining;
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
