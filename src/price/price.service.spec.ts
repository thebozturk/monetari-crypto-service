import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PriceService } from './price.service';
import { PriceBatcherService } from './price-batcher.service';
import { PriceRecord } from './entities/price-record.entity';

describe('PriceService', () => {
  let service: PriceService;
  let batcherService: jest.Mocked<PriceBatcherService>;
  let mockRepository: Record<string, jest.Mock>;

  const mockPrice = {
    usd: 97000,
    eur: 89000,
    try: 3200000,
    usd_market_cap: 1900000000000,
    usd_24h_change: 2.45,
  };

  const mockRecord = {
    id: 'uuid-123',
    coinId: 'bitcoin',
    priceUsd: 97000,
    priceEur: 89000,
    priceTry: 3200000,
    marketCap: 1900000000000,
    change24h: 2.45,
    queriedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockReturnValue(mockRecord),
      save: jest.fn().mockResolvedValue(mockRecord),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRecord]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceService,
        {
          provide: PriceBatcherService,
          useValue: {
            getPrice: jest.fn().mockResolvedValue(mockPrice),
          },
        },
        {
          provide: getRepositoryToken(PriceRecord),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PriceService>(PriceService);
    batcherService = module.get(PriceBatcherService);
  });

  describe('getCurrentPrice', () => {
    it('should call batcher and save result to DB', async () => {
      const result = await service.getCurrentPrice('Bitcoin');

      expect(batcherService.getPrice).toHaveBeenCalledWith('bitcoin');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coinId: 'bitcoin',
          priceUsd: 97000,
          priceEur: 89000,
          priceTry: 3200000,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          coinId: 'bitcoin',
          priceUsd: 97000,
          priceEur: 89000,
          priceTry: 3200000,
          marketCap: 1900000000000,
          change24h: 2.45,
        }),
      );
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('createdAt');
    });
  });

  describe('getPriceHistory', () => {
    it('should query with correct filters', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      const result = await service.getPriceHistory('Bitcoin', {
        from,
        to,
        limit: 50,
        offset: 10,
      });

      const qb = mockRepository.createQueryBuilder();
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('pr');
      expect(qb.where).toHaveBeenCalledWith('pr.coinId = :coinId', {
        coinId: 'bitcoin',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('pr.queriedAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(50);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          coinId: 'bitcoin',
          priceUsd: 97000,
        }),
      );
      expect(result[0]).not.toHaveProperty('id');
    });
  });
});
