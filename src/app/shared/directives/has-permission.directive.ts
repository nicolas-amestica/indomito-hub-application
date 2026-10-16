import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import type { AuthAllowance } from '../../core/auth/auth.models';

export interface PermissionRequirement {
  readonly module: string;
  readonly allowance: AuthAllowance;
}

@Directive({
  selector: '[appHasPermission]',
})
export class HasPermissionDirective {
  readonly appHasPermission = input.required<PermissionRequirement>();

  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private rendered = false;

  constructor() {
    effect(() => {
      const requirement = this.appHasPermission();
      const allowed = this.auth.canPerform(requirement.module, requirement.allowance);
      if (allowed === this.rendered) return;

      this.container.clear();
      if (allowed) this.container.createEmbeddedView(this.template);
      this.rendered = allowed;
    });
  }
}
