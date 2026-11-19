import {
  BALANCE_MESSAGE_TOKENS,
  BALANCE_TAG_TOKENS,
  BALANCE_EXPORT_TOKENS,
} from '../constants/balance-design-tokens';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { UIChart } from 'primeng/chart';
import { Panel } from 'primeng/panel';
import { Table } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import type { BalanceChart } from '../types/balance-chart';

/** Gráfico accesible: explicación, procedencia y alternativa tabular del mismo conjunto. */
@Component({
  selector: 'app-balance-chart',
  standalone: true,
  imports: [UIChart, Panel, Table, Tag, Message, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <p-panel [header]="chart().title" [pt]="panelPassThrough">
    <div class="space-y-4 min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <p-tag
          [dt]="tagTokens"
          [severity]="chart().simulated ? 'info' : 'secondary'"
          [value]="chart().simulated ? 'Estimación / simulación' : 'Datos operativos'"
        /><span class="text-xs text-muted">{{ chart().unit }}</span>
      </div>
      <p class="text-sm text-muted">{{ chart().meaning }}</p>
      @if (chart().issue) {
        <p-message [dt]="messageTokens" severity="warn">{{ chart().issue }}</p-message>
      }
      @if (chart().rows.length && !chart().issue) {
        <p-chart
          [type]="chart().type"
          [data]="chart().data"
          [options]="chart().options"
          height="290px"
          [ariaLabel]="chart().title + '. Consulta los valores en la tabla siguiente.'"
        />
      } @else if (!chart().issue) {
        <p-message [dt]="messageTokens" severity="info"
          >No hay movimientos o partidas en este alcance.</p-message
        >
      }
      <p class="text-xs text-muted">Fuente: {{ chart().source }}</p>
      <details class="min-w-0">
        <summary class="cursor-pointer text-sm underline underline-offset-4 py-2">
          Ver valores y alternativa al gráfico
        </summary>
        <p-table [value]="chart().rows" [scrollable]="true" size="small">
          <ng-template #header
            ><tr>
              <th scope="col">Concepto</th>
              @for (series of chart().series; track series) {
                <th scope="col">{{ series }}</th>
              }
            </tr></ng-template
          >
          <ng-template #body let-row
            ><tr>
              <th scope="row">{{ row.label }}</th>
              @for (value of row.values; track $index) {
                <td>{{ value === null ? 'Sin datos' : (value | number: '1.0-2' : 'es-CL') }}</td>
              }
            </tr></ng-template
          >
        </p-table>
      </details>
    </div>
  </p-panel>`,
  host: { class: 'block min-w-0' },
})
export class BalanceChartComponent {
  readonly messageTokens = BALANCE_MESSAGE_TOKENS;
  readonly tagTokens = BALANCE_TAG_TOKENS;
  readonly exportTokens = BALANCE_EXPORT_TOKENS;
  readonly panelPassThrough = {
    contentWrapper: { class: 'max-w-full min-w-0' },
    content: { class: 'max-w-full min-w-0' },
  };
  readonly chart = input.required<BalanceChart>();
}
