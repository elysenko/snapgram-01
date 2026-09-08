import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SessionUser, USER_SELECT, UserLike, toSessionUser, toWireRole } from '../common/wire';
import { BCRYPT_ROUNDS, JWT_EXPIRES_IN } from './auth.constants';
import type { AuthUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

export interface AuthResult {
  accessToken: string;
  user: SessionUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Derive a URL-safe profile slug from the email local part, appending a
   * numeric suffix on collision (alice@a, alice@b -> "alice", "alice2").
   */
  private async deriveHandle(email: string): Promise<string> {
    const base =
      email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'member';
    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}${suffix + 1}`;
      const taken = await this.prisma.user.findUnique({
        where: { handle: candidate },
        select: { id: true },
      });
      if (!taken) {
        return candidate;
      }
    }
    // Astronomically unlikely; keeps the return type non-nullable.
    return `${base}-${Date.now().toString(36)}`;
  }

  signAccessToken(user: UserLike): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: toWireRole(user.role),
      handle: user.handle ?? user.id,
    };
    return this.jwt.sign(payload, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Create a member account. `role` is assigned here, never taken from the
   * request body, so signup can never mint a moderator.
   */
  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // deriveHandle is a check-then-insert, so two concurrent signups whose emails
    // share a local part ("alice@a", "alice@b") can both pick "alice". Retry on a
    // handle collision instead of failing the signup: the second caller gets
    // "alice2". An email collision is a genuine conflict and is reported as one.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const handle = await this.deriveHandle(email);
      try {
        const user = await this.prisma.user.create({
          data: {
            email,
            name: dto.displayName,
            displayName: dto.displayName,
            handle,
            passwordHash,
            role: Role.USER,
          },
          select: USER_SELECT,
        });
        return { accessToken: this.signAccessToken(user), user: toSessionUser(user) };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        // `meta.target` names the constraint that actually fired, so a handle
        // race is no longer misreported as a duplicate email.
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
        if (fields.some((field) => field.includes('email'))) {
          throw new ConflictException('An account with that email already exists');
        }
        // Handle collision — loop and derive a fresh candidate.
      }
    }

    throw new ConflictException('Could not allocate a profile handle — please try again');
  }

  /**
   * Verify credentials against the bcrypt hash written by the platform seed.
   * Both "no such user" and "wrong password" answer with the identical 401 so
   * the endpoint cannot be used to enumerate accounts.
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { accessToken: this.signAccessToken(user), user: toSessionUser(user) };
  }

  /** Re-read the principal from the database so `me` reflects later edits. */
  async me(principal: AuthUser): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toSessionUser(user);
  }
}
