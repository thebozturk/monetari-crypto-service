import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'monetari' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'monetari123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
