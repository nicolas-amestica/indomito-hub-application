import type { RealtimeSequenceAction } from '../types/realtime-sequence-action.type';

export function classifyRealtimeSequence(
  currentSequence: number,
  incomingSequence: number,
): RealtimeSequenceAction {
  if (incomingSequence <= currentSequence) return 'ignore';
  if (incomingSequence === currentSequence + 1) return 'accept';
  return 'reconcile';
}
