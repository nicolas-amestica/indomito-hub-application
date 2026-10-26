import type { NonTerminalSend } from '../interfaces/conversation.interface';

const nonTerminalStates = new Set<NonTerminalSend['state']>([
  'reserved',
  'provider_pending',
  'recovering',
  'uncertain',
  'failed_retryable',
]);

export function isNonTerminalSend(send: { readonly state: string }): send is NonTerminalSend {
  return nonTerminalStates.has(send.state as NonTerminalSend['state']);
}
