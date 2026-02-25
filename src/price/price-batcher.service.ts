import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinGeckoPrice, CoinGeckoService } from './coingecko.service';

export interface BatchedPriceResult {
  data: CoinGeckoPrice;
  fromCache: boolean;
}

interface BatchEntry {
  resolvers: Array<{
    resolve: (value: BatchedPriceResult) => void;
    reject: (reason: unknown) => void;
  }>;
  timer: NodeJS.Timeout;
}

interface CacheEntry {
  data: CoinGeckoPrice;
  cachedAt: number;
}

@Injectable()
export class PriceBatcherService implements OnModuleDestroy {
  private readonly logger = new Logger(PriceBatcherService.name);
  private readonly batches = new Map<string, BatchEntry>();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CoinGeckoPrice>>();
  private readonly waitTimeMs: number;
  private readonly threshold: number;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly coinGeckoService: CoinGeckoService,
    private readonly configService: ConfigService,
  ) {
    this.waitTimeMs = this.configService.get<number>('batch.waitTimeMs', 5000);
    this.threshold = this.configService.get<number>('batch.threshold', 3);
    this.cacheTtlMs = this.configService.get<number>('batch.cacheTtlMs', 5000);
  }

  async getPrice(coinId: string): Promise<BatchedPriceResult> {
    const normalizedId = coinId.toLowerCase().trim();

    // 1) Cache hit
    const cached = this.cache.get(normalizedId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      this.logger.log(`Cache hit for ${normalizedId}`);
      return { data: cached.data, fromCache: true };
    }

    // 2) Inflight — API call devam ediyorsa bekle, yeni call açma
    const pending = this.inflight.get(normalizedId);
    if (pending) {
      this.logger.log(`Inflight hit for ${normalizedId}`);
      const data = await pending;
      return { data, fromCache: true };
    }

    // 3) Batch'e ekle
    return new Promise<BatchedPriceResult>((resolve, reject) => {
      const existing = this.batches.get(normalizedId);

      if (existing) {
        existing.resolvers.push({ resolve, reject });
        this.logger.log(
          `Request added to batch for ${normalizedId} (${existing.resolvers.length} pending)`,
        );

        if (existing.resolvers.length >= this.threshold) {
          this.logger.log(`Threshold reached for ${normalizedId}, flushing`);
          this.flush(normalizedId);
        }
      } else {
        const timer = setTimeout(() => {
          this.flush(normalizedId);
        }, this.waitTimeMs);

        this.batches.set(normalizedId, {
          resolvers: [{ resolve, reject }],
          timer,
        });

        this.logger.log(`Batch started for ${normalizedId}`);
      }
    });
  }

  private flush(coinId: string): void {
    const entry = this.batches.get(coinId);
    if (!entry) return;

    const { resolvers, timer } = entry;
    this.batches.delete(coinId);
    clearTimeout(timer);

    const apiCall = this.coinGeckoService.getSimplePrice(coinId);

    // Store raw promise so inflight waiters can await the same API call
    this.inflight.set(coinId, apiCall);

    apiCall
      .then((price) => {
        this.cache.set(coinId, { data: price, cachedAt: Date.now() });
        this.logger.log(
          `Batch flushed for ${coinId}, served ${resolvers.length} requests`,
        );
        resolvers.forEach((r) => r.resolve({ data: price, fromCache: false }));
      })
      .catch((error) => {
        this.logger.error(`Batch failed for ${coinId}: ${error}`);
        resolvers.forEach((r) => r.reject(error));
      })
      .finally(() => {
        this.inflight.delete(coinId);
      });
  }

  onModuleDestroy() {
    for (const [coinId, entry] of this.batches) {
      clearTimeout(entry.timer);
      entry.resolvers.forEach((r) =>
        r.reject(new Error('Service is shutting down')),
      );
      this.logger.warn(`Rejected pending batch for ${coinId} on shutdown`);
    }
    this.batches.clear();
    this.cache.clear();
    this.inflight.clear();
  }
}
