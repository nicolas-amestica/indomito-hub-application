export interface AuthUser {
  id: string;
  name: string;
  email: string;
  rut: string;
  profileCode: string;
  active: boolean;
}
export interface AuthModule {
  code: string;
  title: string;
  path: string;
  icon: string;
  order: number;
  active: boolean;
  endpoints: string[];
}
export interface AuthPermission {
  module: AuthModule;
  allowances: string[];
}
export interface AuthSession {
  token: string;
  expiresIn: number;
  user: AuthUser;
  permissions: AuthPermission[];
}
export interface ApiEnvelope<T> {
  data: T;
}
