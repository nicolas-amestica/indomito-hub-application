import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IamAllowance, IamModule, IamProfile, IamUser } from './iam.models';
import { IamService } from './iam.service';
import { AuthService } from '../../core/auth/auth.service';

type Tab = 'users' | 'profiles' | 'modules';
type Dialog = 'user' | 'profile' | 'module' | 'permissions' | null;
const EMPTY_USER = () => ({ id: '', name: '', email: '', rut: '', password: '', profileCode: 'ADMIN', active: true });
const EMPTY_PROFILE = () => ({ code: '', title: '', description: '', tooltip: '', active: true, isDeprecated: false });
const EMPTY_MODULE = () => ({ code: '', title: '', category: 'Administración', path: '/', icon: 'icon-[tabler--point]', color: '#3A3A3A', order: 1, active: true, endpoints: '', tooltip: '', level: 'LV1' as const, parentCode: '', isDeprecated: false });

@Component({ selector: 'app-iam', imports: [FormsModule], templateUrl: './iam.page.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class IamPage {
  private readonly api = inject(IamService);
  private readonly auth = inject(AuthService);
  readonly tab = signal<Tab>('users'); readonly dialog = signal<Dialog>(null);
  readonly users = signal<IamUser[]>([]); readonly profiles = signal<IamProfile[]>([]); readonly modules = signal<IamModule[]>([]);
  readonly busy = signal(true); readonly saving = signal(false); readonly message = signal(''); readonly search = signal('');
  readonly selectedProfile = signal<IamProfile | null>(null); readonly grants = signal<Record<string, IamAllowance[]>>({});
  readonly editingProfileCode = signal(''); readonly editingModuleCode = signal('');
  readonly user = EMPTY_USER(); readonly profile = EMPTY_PROFILE(); readonly module = EMPTY_MODULE();
  readonly allowances: Array<{ code: IamAllowance; label: string }> = [{ code: 'c', label: 'Crear' }, { code: 'r', label: 'Leer' }, { code: 'u', label: 'Editar' }, { code: 'd', label: 'Eliminar' }];
  readonly rootModules = computed(() => this.modules().filter((m) => m.level !== 'LV2'));
  readonly visibleUsers = computed(() => { const q = this.search().toLowerCase().trim(); return this.users().filter((u) => !q || `${u.name} ${u.email} ${u.rut} ${u.profileCode}`.toLowerCase().includes(q)); });
  readonly visibleProfiles = computed(() => { const q = this.search().toLowerCase().trim(); return this.profiles().filter((p) => !q || `${p.code} ${p.title}`.toLowerCase().includes(q)); });
  readonly visibleModules = computed(() => { const q = this.search().toLowerCase().trim(); return this.modules().filter((m) => !q || `${m.code} ${m.title} ${m.path}`.toLowerCase().includes(q)); });

  constructor() { void this.load(); }
  async load() { this.busy.set(true); try { const [users, profiles, modules] = await Promise.all([firstValueFrom(this.api.users()), firstValueFrom(this.api.profiles()), firstValueFrom(this.api.modules())]); this.users.set(users); this.profiles.set(profiles); this.modules.set(modules); } catch { this.message.set('No fue posible cargar la administración IAM.'); } finally { this.busy.set(false); } }
  changeTab(tab: Tab) { this.tab.set(tab); this.search.set(''); }
  openCreate() { if (this.tab() === 'users') { Object.assign(this.user, EMPTY_USER()); this.dialog.set('user'); } if (this.tab() === 'profiles') { this.editingProfileCode.set(''); Object.assign(this.profile, EMPTY_PROFILE()); this.dialog.set('profile'); } if (this.tab() === 'modules') { this.editingModuleCode.set(''); Object.assign(this.module, EMPTY_MODULE()); this.dialog.set('module'); } }
  editUser(item: IamUser) { Object.assign(this.user, item, { password: '' }); this.dialog.set('user'); }
  editProfile(item: IamProfile) { this.editingProfileCode.set(item.code); Object.assign(this.profile, item); this.dialog.set('profile'); }
  editModule(item: IamModule) { this.editingModuleCode.set(item.code); Object.assign(this.module, item, { endpoints: item.endpoints.join(', ') }); this.dialog.set('module'); }
  closeDialog() { if (!this.saving()) this.dialog.set(null); }
  async saveUser() { await this.perform(async () => { await firstValueFrom(this.user.id ? this.api.updateUser(this.user.id, this.user) : this.api.saveUser(this.user)); }, 'Usuario guardado.'); }
  async saveProfile() { await this.perform(async () => { const code = this.editingProfileCode(); await firstValueFrom(code ? this.api.updateProfile(code, this.profile) : this.api.saveProfile(this.profile)); }, 'Perfil guardado.'); }
  async saveModule() { const payload = { ...this.module, level: this.module.parentCode ? 'LV2' : 'LV1', endpoints: this.module.endpoints.split(',').map((x) => x.trim()).filter(Boolean) }; await this.perform(async () => { const code = this.editingModuleCode(); await firstValueFrom(code ? this.api.updateModule(code, payload) : this.api.saveModule(payload)); }, 'Módulo guardado.'); }
  async toggleUser(item: IamUser) { await this.perform(() => firstValueFrom(this.api.toggleUser(item.id, !item.active)), `Usuario ${item.active ? 'desactivado' : 'activado'}.`, false); }
  async removeUser(item: IamUser) { if (confirm(`¿Eliminar a ${item.name}?`)) await this.perform(() => firstValueFrom(this.api.deleteUser(item.id)), 'Usuario eliminado.', false); }
  async removeProfile(item: IamProfile) { if (confirm(`¿Eliminar el perfil ${item.title}?`)) await this.perform(() => firstValueFrom(this.api.deleteProfile(item.code)), 'Perfil eliminado.', false); }
  async removeModule(item: IamModule) { if (confirm(`¿Eliminar el módulo ${item.title} y sus submódulos?`)) await this.perform(() => firstValueFrom(this.api.deleteModule(item.code)), 'Módulo eliminado.', false); }
  async managePermissions(profile: IamProfile) { this.selectedProfile.set(profile); this.saving.set(true); this.dialog.set('permissions'); try { const rows = await firstValueFrom(this.api.profilePermissions(profile.code)); this.grants.set(Object.fromEntries(rows.map((row) => [row.module.code, row.allowances as IamAllowance[]]))); } finally { this.saving.set(false); } }
  hasGrant(code: string, allowance: IamAllowance) { return this.grants()[code]?.includes(allowance) ?? false; }
  toggleGrant(code: string, allowance: IamAllowance) { this.grants.update((all) => ({ ...all, [code]: this.hasGrant(code, allowance) ? (all[code] ?? []).filter((x) => x !== allowance) : [...(all[code] ?? []), allowance] })); }
  setAll(module: IamModule, enabled: boolean) { this.grants.update((all) => ({ ...all, [module.code]: enabled ? ['c', 'r', 'u', 'd'] : [] })); }
  async saveMatrix() { const profile = this.selectedProfile(); if (!profile) return; const payload = this.modules().map((module) => ({ moduleCode: module.code, parentCode: module.parentCode ?? '', allowances: this.grants()[module.code] ?? [] })); await this.perform(async () => { await firstValueFrom(this.api.savePermissions(profile.code, payload)); if (profile.code === this.auth.user()?.profileCode) await this.auth.refreshPermissions(); }, 'Permisos actualizados.'); }
  children(parent: string) { return this.modules().filter((m) => m.parentCode === parent); }
  profileTitle(code: string) { return this.profiles().find((p) => p.code === code)?.title ?? code; }
  private async perform(action: () => Promise<unknown>, success: string, close = true) { this.saving.set(true); this.message.set(''); try { await action(); this.message.set(success); if (close) this.dialog.set(null); await this.load(); } catch { this.message.set('La operación no pudo completarse. Revisa los datos y permisos asociados.'); } finally { this.saving.set(false); } }
}
