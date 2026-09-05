import { Body, Controller, HttpCode, HttpException, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface ErrorShape {
  statusCode: number;
  message: string;
}

// AuthService returns a plain object shaped like an error (rather than
// throwing) for expected failure cases like a duplicate email or bad
// credentials, so those can be re-thrown here as a real HttpException
// with the correct status code instead of every failure reading as a
// generic 500.
function isErrorShape(value: unknown): value is ErrorShape {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ErrorShape).statusCode === 'number' &&
    typeof (value as ErrorShape).message === 'string'
  );
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    if (isErrorShape(result)) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    if (isErrorShape(result)) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }
}
