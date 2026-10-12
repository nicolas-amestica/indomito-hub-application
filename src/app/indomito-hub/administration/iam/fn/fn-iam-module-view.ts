import { IAM_MODULE_ICON_FALLBACKS } from '../constants/iam-module-icon-fallbacks.constant';
import type { IamModule } from '../interfaces/iam.interface';

export function filterRootIamModules(modules: readonly IamModule[], search: string): IamModule[] {
  const query = search.toLocaleLowerCase('es-CL').trim();
  return modules.filter((module) => {
    if (module.level !== 'LV1') return false;
    if (!query) return true;
    const children = modules.filter((candidate) => candidate.parentCode === module.code);
    return [module, ...children].some((candidate) =>
      `${candidate.code} ${candidate.title} ${candidate.path}`
        .toLocaleLowerCase('es-CL')
        .includes(query),
    );
  });
}

export function resolveIamModuleIcon(module: Pick<IamModule, 'code' | 'icon'>): string {
  const fallback = IAM_MODULE_ICON_FALLBACKS[module.code];
  if (fallback) return fallback;
  const icon = module.icon?.trim();
  if (!icon || icon.startsWith('pi ')) return 'icon-[tabler--point]';
  if (icon.startsWith('icon-[')) return icon;
  return /^[-a-z0-9]+$/i.test(icon) ? `icon-[tabler--${icon}]` : 'icon-[tabler--point]';
}
