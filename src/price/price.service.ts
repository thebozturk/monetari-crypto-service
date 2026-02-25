import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceRecord } from './entities/price-record.entity';
import { PriceBatcherService } from './price-batcher.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceResponseDto } from './dto/price-response.dto';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  constructor(
    @InjectRepository(PriceRecord)
    private readonly priceRecordRepository: Repository<PriceRecord>,
    private readonly priceBatcherService: PriceBatcherService,
  ) {}

  async getCurrentPrice(coinId: string): Promise<PriceResponseDto> {
    const normalized = coinId.toLowerCase().trim();

    try {
      const { data, fromCache } =
        await this.priceBatcherService.getPrice(normalized);

      if (fromCache) {
        return PriceResponseDto.fromCoinGecko(normalized, data);
      }

      const record = this.priceRecordRepository.create({
        coinId: normalized,
        priceUsd: data.usd,
        priceEur: data.eur ?? null,
        priceTry: data.try ?? null,
        marketCap: data.usd_market_cap ?? null,
        change24h: data.usd_24h_change ?? null,
        queriedAt: new Date(),
      });

      const saved = await this.priceRecordRepository.save(record);
      return PriceResponseDto.fromEntity(saved);
    } catch (error) {
      this.logger.error(`Failed to get price for ${normalized}: ${error}`);
      throw error;
    }
  }

  async getPriceHistory(
    coinId: string,
    query: PriceHistoryQueryDto,
  ): Promise<PriceResponseDto[]> {
    const normalized = coinId.toLowerCase().trim();
    const { from, to, limit = 100, offset = 0 } = query;

    try {
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

      const records = await qb.getMany();
      return records.map(PriceResponseDto.fromEntity);
    } catch (error) {
      this.logger.error(
        `Failed to get price history for ${normalized}: ${error}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve price history',
      );
    }
  }
}
