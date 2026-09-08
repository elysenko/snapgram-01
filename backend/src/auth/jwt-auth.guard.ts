import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Rejects the request with 401 unless a valid, unexpired bearer token is present. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
