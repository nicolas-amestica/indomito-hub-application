import { AuthModule, AuthUser } from '../../core/auth/auth.models';
export interface IamProfile {
  code: string;
  title: string;
  description: string;
  active: boolean;
}
export type IamUser = AuthUser;
export type IamModule = AuthModule;
