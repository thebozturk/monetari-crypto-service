export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'monetari',
    password: process.env.DB_PASSWORD || 'monetari_secret',
    database: process.env.DB_DATABASE || 'monetari_crypto',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  coingecko: {
    apiUrl: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
    apiKey: process.env.COINGECKO_API_KEY || '',
  },
  batch: {
    waitTimeMs: parseInt(process.env.BATCH_WAIT_TIME_MS || '5000', 10),
    threshold: parseInt(process.env.BATCH_THRESHOLD || '3', 10),
  },
});
