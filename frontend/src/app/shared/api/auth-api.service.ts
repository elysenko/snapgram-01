import { Injectable, inject } from '@angular/core';
import { SessionUser } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface AuthResult {
  accessToken: string;
  user: SessionUser;
}

/** POST /api/auth/signup · POST /api/auth/login · GET /api/auth/me */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(ApiClient);

  login(email: string, password: string): Promise<AuthResult> {
    return this.api.post<AuthResult>('/auth/login', { email, password });
  }

  signup(displayName: string, email: string, password: string): Promise<AuthResult> {
    return this.api.post<AuthResult>('/auth/signup', { displayName, email, password });
  }

  me(): Promise<SessionUser> {
    return this.api.get<SessionUser>('/auth/me');
  }
}
