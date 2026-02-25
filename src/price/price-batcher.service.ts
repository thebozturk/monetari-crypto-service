import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinGeckoPrice, CoinGeckoService } from './coingecko.service';

interface BatchEntry {
  resolvers: Array<{
    resolve: (value: CoinGeckoPrice) => void;
    reject: (reason: unknown) => void;
  }>;
  timer: NodeJS.Timeout;
}

@Injectable()
export class PriceBatcherService implements OnModuleDestroy {
  private readonly logger = new Logger(PriceBatcherService.name);
  private readonly batches = new Map<string, BatchEntry>();
  private readonly waitTimeMs: number;
  private readonly threshold: number;

  constructor(
    private readonly coinGeckoService: CoinGeckoService,
    private readonly configService: ConfigService,
  ) {
    this.waitTimeMs = this.configService.get<number>('batch.waitTimeMs', 5000);
    this.threshold = this.configService.get<number>('batch.threshold', 3);
  }

  getPrice(coinId: string): Promise<CoinGeckoPrice> {
    const normalizedId = coinId.toLowerCase().trim();

    return new Promise<CoinGeckoPrice>((resolve, reject) => {
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

    this.coinGeckoService
      .getSimplePrice(coinId)
      .then((price) => {
        this.logger.log(
          `Batch flushed for ${coinId}, served ${resolvers.length} requests`,
        );
        resolvers.forEach((r) => r.resolve(price));
      })
      .catch((error) => {
        this.logger.error(`Batch failed for ${coinId}: ${error}`);
        resolvers.forEach((r) => r.reject(error));
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
  }
}
