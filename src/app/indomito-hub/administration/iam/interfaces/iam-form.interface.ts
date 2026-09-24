import type { IamAllowance } from './iam.interface';

export interface IamUserForm {
  id: string;
  name: string;
  email: string;
  rut: string;
  password: string;
  profileCode: string;
  active: boolean;
}

export interface IamProfileForm {
  code: string;
  title: string;
  description: string;
  tooltip: string;
  active: boolean;
  isDeprecated: boolean;
}

export interface IamModuleForm {
  code: string;
  title: string;
  category: string;
  path: string;
  icon: string;
  color: string;
  order: number;
  active: boolean;
  endpoints: string;
  tooltip: string;
  level: 'LV1' | 'LV2';
  parentCode: string;
  isDeprecated: boolean;
}

export interface IamAllowanceOption {
  code: IamAllowance;
  label: string;
}
