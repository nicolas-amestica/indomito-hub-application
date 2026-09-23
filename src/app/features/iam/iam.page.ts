import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IamModule, IamProfile, IamUser } from './iam.models';
import { IamService } from './iam.service';
@Component({
  selector: 'app-iam',
  imports: [FormsModule],
  templateUrl: './iam.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IamPage {
  private api = inject(IamService);
  readonly tab = signal<'users' | 'profiles' | 'modules'>('users');
  readonly users = signal<IamUser[]>([]);
  readonly profiles = signal<IamProfile[]>([]);
  readonly modules = signal<IamModule[]>([]);
  readonly busy = signal(true);
  readonly selectedProfile = signal<IamProfile | null>(null);
  readonly grants = signal<Record<string, string[]>>({});
  readonly user = {
    name: '',
    email: '',
    rut: '',
    password: '',
    profileCode: 'ADMIN',
    active: true,
  };
  readonly profile = { code: '', title: '', description: '', active: true };
  readonly module = {
    code: '',
    title: '',
    path: '/',
    icon: 'pi pi-circle',
    order: 1,
    active: true,
    endpoints: '',
  };
  constructor() {
    void this.load();
  }
  async load() {
    this.busy.set(true);
    try {
      const [u, p, m] = await Promise.all([
        firstValueFrom(this.api.users()),
        firstValueFrom(this.api.profiles()),
        firstValueFrom(this.api.modules()),
      ]);
      this.users.set(u);
      this.profiles.set(p);
      this.modules.set(m);
    } finally {
      this.busy.set(false);
    }
  }
  selectItem(item: IamUser | IamProfile | IamModule) {
    if (this.tab() === 'users') Object.assign(this.user, item, { password: '' });
    if (this.tab() === 'profiles') {
      Object.assign(this.profile, item);
      void this.selectProfile(item as IamProfile);
    }
    if (this.tab() === 'modules')
      Object.assign(this.module, item, { endpoints: (item as IamModule).endpoints.join(', ') });
  }

  async selectProfile(profile: IamProfile) {
    this.selectedProfile.set(profile);
    const current = await firstValueFrom(this.api.profilePermissions(profile.code));
    this.grants.set(Object.fromEntries(current.map((item) => [item.module.code, item.allowances])));
  }
  toggleModule(code: string) {
    this.grants.update((value) => ({
      ...value,
      [code]: value[code]?.length ? [] : ['c', 'r', 'u', 'd'],
    }));
  }
  async saveMatrix() {
    const profile = this.selectedProfile();
    if (!profile) return;
    await firstValueFrom(
      this.api.savePermissions(
        profile.code,
        this.modules().map((module) => ({
          moduleCode: module.code,
          allowances: this.grants()[module.code] ?? [],
        })),
      ),
    );
    await this.selectProfile(profile);
  }

  async addUser() {
    await firstValueFrom(this.api.saveUser(this.user));
    Object.assign(this.user, {
      name: '',
      email: '',
      rut: '',
      password: '',
      profileCode: 'ADMIN',
      active: true,
    });
    await this.load();
  }
  async addProfile() {
    await firstValueFrom(this.api.saveProfile(this.profile));
    Object.assign(this.profile, { code: '', title: '', description: '', active: true });
    await this.load();
  }
  async addModule() {
    await firstValueFrom(
      this.api.saveModule({
        ...this.module,
        endpoints: this.module.endpoints
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    );
    Object.assign(this.module, {
      code: '',
      title: '',
      path: '/',
      icon: 'pi pi-circle',
      order: 1,
      active: true,
      endpoints: '',
    });
    await this.load();
  }
}
