import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class BotDto {
  @IsString()
  @IsNotEmpty()
  public ip: string;

  @IsString()
  @IsNotEmpty()
  public login: string;

  @IsString()
  @IsNotEmpty()
  public password: string;

  @IsString()
  @IsNotEmpty()
  public user_passwrod: string;

  @IsBoolean()
  @IsNotEmpty()
  public twofa: boolean;

  @IsString()
  public code: string;
}
