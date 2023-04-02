import { IsNotEmpty, IsString } from 'class-validator';

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
}
