import { AuthModule, AuthUser } from '../../core/auth/auth.models';
export interface IamProfile {
  code: string;
  title: string;
  description: string;
  active: boolean;
  tooltip: string;
  isDeprecated: boolean;
  permissionCount: number;
  userCount: number;
}
export type IamUser = AuthUser;
export interface IamModule extends AuthModule {
  tooltip: string;
  color: string;
  level: 'LV1' | 'LV2';
  parentCode?: string;
  isDeprecated: boolean;
  createdAt: string;
}
export type IamAllowance = 'c' | 'r' | 'u' | 'd';
