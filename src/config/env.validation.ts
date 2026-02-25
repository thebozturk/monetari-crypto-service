import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @Min(1)
  PORT!: number;

  @IsString()
  DB_HOST!: string;

  @IsNumber()
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN!: string;

  @IsString()
  COINGECKO_API_URL!: string;

  @IsNumber()
  @Min(100)
  BATCH_WAIT_TIME_MS!: number;

  @IsNumber()
  @Min(1)
  BATCH_THRESHOLD!: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
