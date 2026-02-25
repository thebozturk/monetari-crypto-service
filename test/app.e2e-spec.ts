import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CoinGeckoService } from '../src/price/coingecko.service';

describe('App (e2e)', () => {
  let app: INestApplication;

  const mockCoinGeckoService = {
    getSimplePrice: jest.fn().mockResolvedValue({
      usd: 97000,
      eur: 89000,
      try: 3200000,
      usd_market_cap: 1900000000000,
      usd_24h_change: 2.45,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CoinGeckoService)
      .useValue(mockCoinGeckoService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /health should return ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('Auth', () => {
    it('POST /v1/auth/login with valid credentials should return token', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ username: 'monetari', password: 'monetari123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.access_token).toBeDefined();
        });
    });

    it('POST /v1/auth/login with invalid credentials should return 401', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ username: 'wrong', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Price (authenticated)', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ username: 'monetari', password: 'monetari123' });
      token = res.body.access_token;
    });

    it('GET /v1/price/:coinId without token should return 401', () => {
      return request(app.getHttpServer()).get('/v1/price/bitcoin').expect(401);
    });

    it('GET /v1/price/:coinId with token should return price data', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/price/bitcoin')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.coinId).toBe('bitcoin');
      expect(res.body.priceUsd).toBeDefined();
      expect(res.body.priceEur).toBeDefined();
      expect(res.body.priceTry).toBeDefined();
    }, 15000);

    it('GET /v1/price/:coinId/history should return array', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/price/bitcoin/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
