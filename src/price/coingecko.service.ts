import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface CoinGeckoPrice {
  usd: number;
  eur?: number;
  try?: number;
  usd_market_cap?: number;
  usd_24h_change?: number;
}

export interface CoinGeckoPriceResponse {
  [coinId: string]: CoinGeckoPrice;
}

@Injectable()
export class CoinGeckoService {
  private readonly logger = new Logger(CoinGeckoService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('coingecko.apiUrl')!;
    this.apiKey = this.configService.get<string>('coingecko.apiKey', '')!;
  }

  async getSimplePrice(coinId: string): Promise<CoinGeckoPrice> {
    try {
      const response = await axios.get<CoinGeckoPriceResponse>(
        `${this.apiUrl}/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: 'usd,eur,try',
            include_market_cap: true,
            include_24hr_change: true,
          },
          headers: this.apiKey
            ? { 'x-cg-demo-api-key': this.apiKey }
            : undefined,
        },
      );

      const data = response.data[coinId];

      if (!data) {
        throw new Error(`No price data found for coin: ${coinId}`);
      }

      return data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          this.logger.warn('CoinGecko rate limit reached (429)');
          throw new Error(
            'CoinGecko rate limit exceeded. Please try again later.',
          );
        }
        this.logger.error(
          `CoinGecko API error: ${error.response?.status} - ${error.message}`,
        );
      }
      throw error;
    }
  }
}
