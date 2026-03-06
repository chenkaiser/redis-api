import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MaxLength(50)
  lastName!: string;
}
