import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceRecord } from './entities/price-record.entity';
import { CoinGeckoService } from './coingecko.service';
import { PriceBatcherService } from './price-batcher.service';
import { PriceService } from './price.service';
import { PriceController } from './price.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceRecord])],
  controllers: [PriceController],
  providers: [CoinGeckoService, PriceBatcherService, PriceService],
})
export class PriceModule {}
