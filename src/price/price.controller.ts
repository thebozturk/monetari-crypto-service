import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PriceService } from './price.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';

@ApiTags('Price')
@ApiBearerAuth()
@Controller('v1/price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get(':coinId')
  @ApiOperation({ summary: 'Get current price for a coin (uses batching)' })
  @ApiParam({
    name: 'coinId',
    description: 'Coin identifier (e.g. bitcoin, ethereum, solana)',
    example: 'bitcoin',
  })
  @ApiResponse({
    status: 200,
    description: 'Current price data',
    schema: {
      example: {
        id: 'uuid',
        coinId: 'bitcoin',
        priceUsd: 97000.12345678,
        priceEur: 89000.12345678,
        priceTry: 3200000.12345678,
        marketCap: 1900000000000.0,
        change24h: 2.45,
        queriedAt: '2024-01-01T12:00:00.000Z',
        createdAt: '2024-01-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentPrice(@Param('coinId') coinId: string) {
    return this.priceService.getCurrentPrice(coinId);
  }

  @Get(':coinId/history')
  @ApiOperation({ summary: 'Get price history for a coin' })
  @ApiParam({
    name: 'coinId',
    description: 'Coin identifier (e.g. bitcoin, ethereum, solana)',
    example: 'bitcoin',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of price records, newest first',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPriceHistory(
    @Param('coinId') coinId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.priceService.getPriceHistory(coinId, query);
  }
}
