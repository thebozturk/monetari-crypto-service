import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PriceBatcherService } from './price-batcher.service';
import { CoinGeckoPrice, CoinGeckoService } from './coingecko.service';

describe('PriceBatcherService', () => {
  let service: PriceBatcherService;
  let coinGeckoService: jest.Mocked<CoinGeckoService>;

  const mockPrice: CoinGeckoPrice = {
    usd: 97000,
    eur: 89000,
    try: 3200000,
    usd_market_cap: 1900000000000,
    usd_24h_change: 2.45,
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceBatcherService,
        {
          provide: CoinGeckoService,
          useValue: {
            getSimplePrice: jest.fn().mockResolvedValue(mockPrice),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: number) => {
              if (key === 'batch.waitTimeMs') return 5000;
              if (key === 'batch.threshold') return 3;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PriceBatcherService>(PriceBatcherService);
    coinGeckoService = module.get(CoinGeckoService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should flush after timeout with a single request', async () => {
    const promise = service.getPrice('bitcoin');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const result = await promise;

    expect(result).toEqual({ data: mockPrice, fromCache: false });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledWith('bitcoin');
  });

  it('should batch multiple requests and make a single API call', async () => {
    const promise1 = service.getPrice('bitcoin');
    const promise2 = service.getPrice('bitcoin');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual({ data: mockPrice, fromCache: false });
    expect(result2).toEqual({ data: mockPrice, fromCache: false });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);
  });

  it('should flush immediately when threshold is reached', async () => {
    const promise1 = service.getPrice('bitcoin');
    const promise2 = service.getPrice('bitcoin');
    const promise3 = service.getPrice('bitcoin');

    // no need to advance timers — threshold should trigger flush
    await Promise.resolve();

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    expect(result1).toEqual({ data: mockPrice, fromCache: false });
    expect(result2).toEqual({ data: mockPrice, fromCache: false });
    expect(result3).toEqual({ data: mockPrice, fromCache: false });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);
  });

  it('should handle different coins independently', async () => {
    const ethPrice: CoinGeckoPrice = {
      usd: 3500,
      eur: 3200,
      try: 115000,
    };

    coinGeckoService.getSimplePrice.mockImplementation(
      async (coinId: string) => {
        return coinId === 'bitcoin' ? mockPrice : ethPrice;
      },
    );

    const btcPromise = service.getPrice('bitcoin');
    const ethPromise = service.getPrice('ethereum');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const [btcResult, ethResult] = await Promise.all([btcPromise, ethPromise]);

    expect(btcResult).toEqual({ data: mockPrice, fromCache: false });
    expect(ethResult).toEqual({ data: ethPrice, fromCache: false });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(2);
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledWith('bitcoin');
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledWith('ethereum');
  });

  it('should reject all queued requests on API error', async () => {
    coinGeckoService.getSimplePrice.mockRejectedValue(new Error('API error'));

    const promise1 = service.getPrice('bitcoin');
    const promise2 = service.getPrice('bitcoin');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    await expect(promise1).rejects.toThrow('API error');
    await expect(promise2).rejects.toThrow('API error');
  });

  it('should start a new batch after threshold flush', async () => {
    // first batch: 3 requests → immediate flush
    const p1 = service.getPrice('bitcoin');
    const p2 = service.getPrice('bitcoin');
    const p3 = service.getPrice('bitcoin');

    await Promise.resolve();
    await Promise.all([p1, p2, p3]);

    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);

    // advance past cache TTL (5s) so next request is not served from cache
    jest.advanceTimersByTime(5001);

    // fourth request should start a new batch (cache expired)
    const p4 = service.getPrice('bitcoin');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const result = await p4;

    expect(result).toEqual({ data: mockPrice, fromCache: false });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(2);
  });

  it('should use inflight promise instead of new API call (race condition)', async () => {
    // simulate slow API — resolve is held until we release it
    let resolveApi!: (value: CoinGeckoPrice) => void;
    coinGeckoService.getSimplePrice.mockImplementation(
      () => new Promise((res) => (resolveApi = res)),
    );

    // 1st request → starts batch
    const p1 = service.getPrice('bitcoin');

    // flush triggers after timeout
    jest.advanceTimersByTime(5000);

    // api call is now inflight (not resolved yet)
    // 2nd request arrives while API is still pending
    const p2 = service.getPrice('bitcoin');

    // resolve the API
    resolveApi(mockPrice);
    await Promise.resolve();
    await Promise.resolve();

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual({ data: mockPrice, fromCache: false });
    expect(r2).toEqual({ data: mockPrice, fromCache: true });
    // only 1 API call was made despite 2 separate request windows
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);
  });

  it('should return cached result within TTL', async () => {
    // first request triggers API call
    const p1 = service.getPrice('bitcoin');
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await p1;

    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);

    // second request within 5s should hit cache (no new API call)
    const result = await service.getPrice('bitcoin');

    expect(result).toEqual({ data: mockPrice, fromCache: true });
    expect(coinGeckoService.getSimplePrice).toHaveBeenCalledTimes(1);
  });
});
