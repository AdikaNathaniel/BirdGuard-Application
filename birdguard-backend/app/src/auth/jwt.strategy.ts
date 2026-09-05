import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  userType: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Falls back to a fixed dev-only secret if JWT_SECRET isn't set,
      // so local development doesn't require configuring one -- but the
      // real deployed secret must always be set, or every environment
      // would accept tokens signed with this same well-known fallback.
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'birdguard-dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    // Whatever is returned here is attached to `request.user`.
    return payload;
  }
}
