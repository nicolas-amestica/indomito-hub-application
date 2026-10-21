export interface AuthUser {
  id: string;
  name: string;
  email: string;
  rut: string;
  profileCode: string;
  active: boolean;
  profilePhoto?: string;
}
export interface AuthModule {
  code: string;
  title: string;
  category: string;
  path: string;
  icon: string;
  order: number;
  active: boolean;
  endpoints: string[];
  level?: 'LV1' | 'LV2';
  parentCode?: string;
}
export interface AuthPermission {
  module: AuthModule;
  allowances: string[];
}
export type AuthAllowance = 'c' | 'r' | 'u' | 'd';
export interface AuthSession {
  token: string;
  expiresIn: number;
  user: AuthUser;
  permissions: AuthPermission[];
}
export interface ApiEnvelope<T> {
  data: T;
}
