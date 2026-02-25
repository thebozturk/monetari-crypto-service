import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'monetari' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'monetari123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
