import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MokaAuthDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({ description: 'Moka API Key' })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ description: 'Moka Store ID' })
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional({ description: 'Moka App ID' })
  @IsString()
  @IsOptional()
  appId?: string;

  @ApiPropertyOptional({ description: 'Moka Secret Key' })
  @IsString()
  @IsOptional()
  secretKey?: string;

  @ApiPropertyOptional({ description: 'OAuth Redirect URI' })
  @IsUrl()
  @IsOptional()
  redirectUri?: string;

  @ApiPropertyOptional({ description: 'OAuth Authorization Code' })
  @IsString()
  @IsOptional()
  authorizationCode?: string;

  @ApiPropertyOptional({ description: 'Use sandbox environment' })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;
}

export class MokaOAuthUrlDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({ description: 'Moka App ID' })
  @IsString()
  @IsNotEmpty()
  appId: string;

  @ApiProperty({ description: 'OAuth Redirect URI' })
  @IsUrl()
  @IsNotEmpty()
  redirectUri: string;

  @ApiPropertyOptional({ description: 'Use sandbox environment' })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiPropertyOptional({ description: 'OAuth state parameter' })
  @IsString()
  @IsOptional()
  state?: string;
}

export class MokaOAuthCallbackDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'OAuth state parameter' })
  @IsString()
  @IsOptional()
  state?: string;
}
