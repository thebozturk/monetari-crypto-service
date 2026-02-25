import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class CoinIdValidationPipe implements PipeTransform<string, string> {
  private readonly pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  transform(value: string): string {
    const normalized = value.toLowerCase().trim();

    if (!normalized || normalized.length > 100) {
      throw new BadRequestException(
        'coinId must be between 1 and 100 characters',
      );
    }

    if (!this.pattern.test(normalized)) {
      throw new BadRequestException(
        'coinId must contain only lowercase letters, numbers and hyphens (e.g. bitcoin, shiba-inu)',
      );
    }

    return normalized;
  }
}
