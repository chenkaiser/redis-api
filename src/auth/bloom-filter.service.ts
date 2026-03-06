import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const BLOOM_KEY = 'bloom:usernames';

/**
 * Bloom filter backed by Redis bit array (SETBIT / GETBIT).
 * Works on standard redis:7-alpine — no extra modules required.
 *
 * Parameters (tuned for 100,000 users at ~1% false positive rate):
 *   n = 100,000 expected usernames
 *   p = ~1% false positive rate
 *   m = 1,000,000 bits  (~122 KB in Redis)  formula: -n·ln(p) / ln(2)²  → 958,506 → 1,000,000
 *   k = 7 hash functions                     formula: (m/n)·ln(2) ≈ 6.93 → 7
 *
 * Double hashing: positions[i] = (h1 + i * h2) % m
 *   h1 = FNV-1a mod m,  h2 = DJB2 mod m (forced odd, bounded within m)
 *   Both base hashes are reduced to [0, m) before arithmetic to keep all
 *   intermediate values positive — avoiding signed int32 overflow from
 *   bitwise operators on large uint32 values.
 *
 * A positive result means the username *might* exist — callers must still
 * verify with Keycloak. A negative result is definitive: the username is new.
 */
@Injectable()
export class BloomFilterService {
  private static readonly BIT_SIZE = 1_000_000;
  private static readonly NUM_HASHES = 7;

  constructor(private readonly redis: RedisService) {}

  private fnv1a(value: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
  }

  private djb2(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = (Math.imul(hash, 33) ^ value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private positions(value: string): number[] {
    const m = BloomFilterService.BIT_SIZE;
    // Reduce to [0, m) before arithmetic — keeps all values positive and avoids
    // signed int32 overflow that bitwise operators (|, &) cause on large uint32s.
    const h1 = this.fnv1a(value) % m;
    const h2raw = this.djb2(value) % m;
    // Force h2 odd (guarantees double-hashing covers all slots) without using |
    const h2 = h2raw % 2 === 0 ? h2raw + 1 : h2raw;
    return Array.from(
      { length: BloomFilterService.NUM_HASHES },
      (_, i) => (h1 + i * h2) % m,
    );
  }

  /**
   * Returns true if the username *might* exist (could be a false positive).
   * Returns false if the username definitely does not exist.
   */
  async mightExist(username: string): Promise<boolean> {
    const bits = await Promise.all(
      this.positions(username).map((pos) => this.redis.getbit(BLOOM_KEY, pos)),
    );
    return bits.every((bit) => bit === 1);
  }

  /** Add a username to the filter after successful registration. */
  async add(username: string): Promise<void> {
    await Promise.all(
      this.positions(username).map((pos) => this.redis.setbit(BLOOM_KEY, pos, 1)),
    );
  }
}
