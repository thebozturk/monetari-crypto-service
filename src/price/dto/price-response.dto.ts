import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceRecord } from '../entities/price-record.entity';
import { CoinGeckoPrice } from '../coingecko.service';

export class PriceResponseDto {
  @ApiProperty({ example: 'bitcoin' })
  coinId!: string;

  @ApiProperty({ example: 97000.12345678 })
  priceUsd!: number;

  @ApiPropertyOptional({ example: 89000.12345678 })
  priceEur!: number | null;

  @ApiPropertyOptional({ example: 3200000.12345678 })
  priceTry!: number | null;

  @ApiPropertyOptional({ example: 1900000000000.0 })
  marketCap!: number | null;

  @ApiPropertyOptional({ example: 2.45 })
  change24h!: number | null;

  @ApiProperty({ example: '2026-02-25T12:00:00.000Z' })
  queriedAt!: Date;

  static fromEntity(entity: PriceRecord): PriceResponseDto {
    const dto = new PriceResponseDto();
    dto.coinId = entity.coinId;
    dto.priceUsd = toNumber(entity.priceUsd);
    dto.priceEur = entity.priceEur != null ? toNumber(entity.priceEur) : null;
    dto.priceTry = entity.priceTry != null ? toNumber(entity.priceTry) : null;
    dto.marketCap =
      entity.marketCap != null ? toNumber(entity.marketCap) : null;
    dto.change24h =
      entity.change24h != null ? toNumber(entity.change24h) : null;
    dto.queriedAt = entity.queriedAt;
    return dto;
  }

  static fromCoinGecko(
    coinId: string,
    price: CoinGeckoPrice,
  ): PriceResponseDto {
    const dto = new PriceResponseDto();
    dto.coinId = coinId;
    dto.priceUsd = price.usd;
    dto.priceEur = price.eur ?? null;
    dto.priceTry = price.try ?? null;
    dto.marketCap = price.usd_market_cap ?? null;
    dto.change24h = price.usd_24h_change ?? null;
    dto.queriedAt = new Date();
    return dto;
  }
}

function toNumber(value: string | number): number {
  return typeof value === 'string' ? parseFloat(value) : value;
}
