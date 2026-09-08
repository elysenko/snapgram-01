import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { guestGuard } from './core/guest.guard';
import { moderatorGuard } from './core/moderator.guard';

/**
 * Every navigable state is URL-addressable: screens are routes, and panel /
 * tab / dialog state rides in query params so deep links and browser history
 * both work.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'explore' },
  {
    path: 'explore',
    data: { flow: 'explore' },
    loadComponent: () => import('./features/explore/explore.component').then((m) => m.ExploreComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    data: { flow: 'auth-login' },
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    data: { flow: 'auth-signup' },
    loadComponent: () => import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    data: { flow: 'feed' },
    loadComponent: () => import('./features/feed/feed.component').then((m) => m.FeedComponent),
  },
  {
    path: 'upload',
    canActivate: [authGuard],
    data: { flow: 'upload' },
    loadComponent: () => import('./features/upload/upload.component').then((m) => m.UploadComponent),
  },
  {
    path: 'p/:postId',
    data: { flow: 'post-detail' },
    loadComponent: () => import('./features/post/post-detail.component').then((m) => m.PostDetailComponent),
  },
  {
    path: 'u/:handle',
    data: { flow: 'profile' },
    loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'settings/profile',
    canActivate: [authGuard],
    data: { flow: 'profile-settings' },
    loadComponent: () =>
      import('./features/settings/profile-settings.component').then((m) => m.ProfileSettingsComponent),
  },
  {
    path: 'moderation',
    canActivate: [moderatorGuard],
    data: { flow: 'moderation' },
    loadComponent: () => import('./features/moderation/moderation.component').then((m) => m.ModerationComponent),
  },
  {
    path: 'admin/settings',
    canActivate: [moderatorGuard],
    data: { flow: 'admin-settings' },
    loadComponent: () => import('./features/admin/admin-settings.component').then((m) => m.AdminSettingsComponent),
  },
  {
    path: '**',
    data: { flow: 'not-found' },
    loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent),
  },
];
