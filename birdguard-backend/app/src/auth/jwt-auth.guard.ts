import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Applied via @UseGuards(JwtAuthGuard) on any route that requires a valid
// Bearer token -- delegates entirely to the 'jwt' Passport strategy
// registered in jwt.strategy.ts.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
