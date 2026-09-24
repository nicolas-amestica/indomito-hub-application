import type { IamModuleForm, IamProfileForm, IamUserForm } from '../interfaces/iam-form.interface';

export function createEmptyIamUser(): IamUserForm {
  return {
    id: '',
    name: '',
    email: '',
    rut: '',
    password: '',
    profileCode: 'ADMIN',
    active: true,
  };
}

export function createEmptyIamProfile(): IamProfileForm {
  return {
    code: '',
    title: '',
    description: '',
    tooltip: '',
    active: true,
    isDeprecated: false,
  };
}

export function createEmptyIamModule(): IamModuleForm {
  return {
    code: '',
    title: '',
    category: 'Administración',
    path: '/',
    icon: 'icon-[tabler--point]',
    color: '#3A3A3A',
    order: 1,
    active: true,
    endpoints: '',
    tooltip: '',
    level: 'LV1',
    parentCode: '',
    isDeprecated: false,
  };
}
