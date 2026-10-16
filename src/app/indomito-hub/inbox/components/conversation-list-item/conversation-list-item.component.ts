import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { formatInboxTime } from '../../fn/format-inbox-time';
import type { ConversationSummary } from '../../interfaces/conversation.interface';

@Component({
  selector: 'app-conversation-list-item',
  templateUrl: './conversation-list-item.component.html',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ConversationListItemComponent {
  readonly conversation = input.required<ConversationSummary>();
  readonly selected = input(false);
  readonly selectedConversation = output<string>();
  readonly initials = computed(() => {
    const label = this.conversation().alias || this.conversation().phone;
    return label.split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  });
  readonly time = computed(() => formatInboxTime(this.conversation().lastMessageAt));
}
