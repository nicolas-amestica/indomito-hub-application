import { describe, expect, it } from 'vitest';

import type { IamModule } from '../interfaces/iam.interface';
import { filterRootIamModules, resolveIamModuleIcon } from './fn-iam-module-view';

function module(overrides: Partial<IamModule>): IamModule {
  return {
    code: 'ROOT',
    title: 'Principal',
    category: 'Administración',
    path: '/',
    icon: 'icon-[tabler--settings]',
    color: '#3A3A3A',
    order: 1,
    active: true,
    endpoints: [],
    tooltip: '',
    level: 'LV1',
    isDeprecated: false,
    createdAt: '',
    ...overrides,
  };
}

describe('IAM module view helpers', () => {
  it('returns only LV1 modules and keeps a parent when the search matches a child', () => {
    const modules = [
      module({ code: 'ADM', title: 'Administración' }),
      module({ code: 'IAM', title: 'Administración IAM', level: 'LV2', parentCode: 'ADM' }),
      module({ code: 'PAY', title: 'Pagos' }),
    ];

    expect(filterRootIamModules(modules, '')).toEqual([modules[0], modules[2]]);
    expect(filterRootIamModules(modules, 'iam')).toEqual([modules[0]]);
  });

  it.each([
    ['PAY', 'pi pi-wallet', 'icon-[tabler--wallet]'],
    ['PAYMENT_OPERATIONS', 'pi pi-chart-line', 'icon-[tabler--cash-register]'],
    ['PAYMENT_SETUP', 'pi pi-play-circle', 'icon-[tabler--rocket]'],
    ['MEET_AGENDA', 'icon-[tabler--video]', 'icon-[tabler--video]'],
  ])('resolves the icon for %s', (code, icon, expected) => {
    expect(resolveIamModuleIcon(module({ code, icon }))).toBe(expected);
  });
});
