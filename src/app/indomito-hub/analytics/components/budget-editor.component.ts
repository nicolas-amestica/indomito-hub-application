import {
  BALANCE_MESSAGE_TOKENS,
  BALANCE_TAG_TOKENS,
  BALANCE_EXPORT_TOKENS,
} from '../constants/balance-design-tokens';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DateOnlyPickerComponent } from '../../../shared/date-only/date-only-picker.component';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { Panel } from 'primeng/panel';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import type { BalanceBudget, BudgetLine } from '../interfaces/balance.interface';
import type { SupplierCommitment } from '../../collections/interfaces/collection-treasury.interface';
import { BASIS_OPTIONS, CHARGE_OPTIONS, LINE_STATES } from '../constants/balance-options';
import { createLine } from '../fn/create-budget';
import { balanceId } from '../fn/balance-id';

/** Editor de entradas: no calcula ni persiste compromisos o pagos. */
@Component({
  selector: 'app-budget-editor',
  standalone: true,
  imports: [
    DateOnlyPickerComponent,
    FormsModule,
    Button,
    InputText,
    InputNumber,
    Select,
    Checkbox,
    Panel,
    Message,
    Textarea,
  ],
  templateUrl: './budget-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetEditorComponent {
  readonly messageTokens = BALANCE_MESSAGE_TOKENS;
  readonly tagTokens = BALANCE_TAG_TOKENS;
  readonly exportTokens = BALANCE_EXPORT_TOKENS;
  readonly budget = input.required<BalanceBudget>();
  readonly today = input.required<string>();
  readonly disabled = input(false);
  readonly suppliers = input<SupplierCommitment[]>([]);
  readonly budgetChange = output<BalanceBudget>();
  readonly charges = CHARGE_OPTIONS;
  readonly bases = BASIS_OPTIONS;
  readonly states = LINE_STATES;
  readonly currencies = ['CLP', 'USD', 'BRL'];
  patch(patch: Partial<BalanceBudget>): void {
    this.budgetChange.emit({ ...this.budget(), ...patch });
  }
  line(id: string, patch: Partial<BudgetLine>): void {
    this.patch({
      lines: this.budget().lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    });
  }
  add(): void {
    this.patch({ lines: [...this.budget().lines, createLine(this.budget(), this.today())] });
  }
  remove(id: string): void {
    this.patch({ lines: this.budget().lines.filter((line) => line.id !== id) });
  }
  category(name: string): void {
    if (name.trim().length > 1)
      this.patch({
        categories: [...this.budget().categories, { id: balanceId(), name: name.trim() }],
      });
  }
  renameCategory(id: string, name: string): void {
    this.patch({
      categories: this.budget().categories.map((category) =>
        category.id === id ? { ...category, name } : category,
      ),
    });
  }
  tax(patch: Partial<BalanceBudget['taxes']>): void {
    this.patch({ taxes: { ...this.budget().taxes, ...patch } });
  }
  currency(id: string, value: BudgetLine['currency']): void {
    this.line(id, {
      currency: value,
      rate: value === 'CLP' ? 1 : 0,
      buffer: 0,
      rateSource: value === 'CLP' ? 'CLP sin conversión' : '',
      rateDate: this.today(),
    });
  }
  addTier(line: BudgetLine): void {
    this.line(line.id, {
      tiers: [
        ...line.tiers,
        { from: (line.tiers.at(-1)?.from ?? 0) + 1, unitPrice: line.unitPrice },
      ],
    });
  }
  tier(line: BudgetLine, index: number, patch: Partial<BudgetLine['tiers'][number]>): void {
    this.line(line.id, {
      tiers: line.tiers.map((tier, position) =>
        position === index ? { ...tier, ...patch } : tier,
      ),
    });
  }
  link(line: BudgetLine, supplierId: string, amount: number): void {
    if (supplierId)
      this.line(line.id, {
        allocations: [
          ...line.allocations.filter((allocation) => allocation.supplierId !== supplierId),
          { supplierId, amount },
        ],
      });
  }
  flow(index: number, patch: Partial<BalanceBudget['flows'][number]>): void {
    this.patch({
      forecastComplete: false,
      flows: this.budget().flows.map((flow, position) =>
        position === index ? { ...flow, ...patch } : flow,
      ),
    });
  }
  addFlow(): void {
    this.patch({
      forecastComplete: false,
      flows: [
        ...this.budget().flows,
        { date: this.today(), description: 'Movimiento previsto', amount: 0 },
      ],
    });
  }
  removeFlow(index: number): void {
    this.patch({
      forecastComplete: false,
      flows: this.budget().flows.filter((_, position) => position !== index),
    });
  }
}
