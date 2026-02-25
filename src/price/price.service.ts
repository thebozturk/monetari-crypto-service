import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceRecord } from './entities/price-record.entity';
import { PriceBatcherService } from './price-batcher.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';

@Injectable()
export class PriceService {
  constructor(
    @InjectRepository(PriceRecord)
    private readonly priceRecordRepository: Repository<PriceRecord>,
    private readonly priceBatcherService: PriceBatcherService,
  ) {}

  async getCurrentPrice(coinId: string): Promise<PriceRecord> {
    const normalized = coinId.toLowerCase().trim();
    const priceData = await this.priceBatcherService.getPrice(normalized);

    const record = this.priceRecordRepository.create({
      coinId: normalized,
      priceUsd: priceData.usd,
      priceEur: priceData.eur ?? null,
      priceTry: priceData.try ?? null,
      marketCap: priceData.usd_market_cap ?? null,
      change24h: priceData.usd_24h_change ?? null,
      queriedAt: new Date(),
    });

    return this.priceRecordRepository.save(record);
  }

  async getPriceHistory(
    coinId: string,
    query: PriceHistoryQueryDto,
  ): Promise<PriceRecord[]> {
    const normalized = coinId.toLowerCase().trim();
    const { from, to, limit = 100, offset = 0 } = query;

    const qb = this.priceRecordRepository
      .createQueryBuilder('pr')
      .where('pr.coinId = :coinId', { coinId: normalized })
      .orderBy('pr.queriedAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (from) {
      qb.andWhere('pr.queriedAt >= :from', { from });
    }

    if (to) {
      qb.andWhere('pr.queriedAt <= :to', { to });
    }

    return qb.getMany();
  }
}
