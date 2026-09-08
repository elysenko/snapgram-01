import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, JwtPayload } from './auth.types';
import { JWT_SECRET } from './auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Expired tokens must fail verification — this is what makes the 7 day
      // lifetime meaningful rather than decorative.
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  /** Whatever this returns becomes `request.user`. */
  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      handle: payload.handle,
    };
  }
}
