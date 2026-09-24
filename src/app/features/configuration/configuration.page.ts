import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AppConfigurationService } from '../../core/configuration/app-configuration.service';

@Component({
  selector: 'app-configuration',
  imports: [FormsModule],
  templateUrl: './configuration.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationPage {
  readonly configuration = inject(AppConfigurationService);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly form = {
    vatRate: this.configuration.taxes().vatRate,
    crewWithholdingRate: this.configuration.taxes().crewWithholdingRate,
  };

  constructor() {
    effect(() => Object.assign(this.form, this.configuration.taxes()));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    try {
      await this.configuration.save(this.form);
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
