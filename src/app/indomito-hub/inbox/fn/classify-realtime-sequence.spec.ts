import { classifyRealtimeSequence } from './classify-realtime-sequence';

describe('classifyRealtimeSequence', () => {
  it('acepta el evento siguiente', () => {
    expect(classifyRealtimeSequence(41, 42)).toBe('accept');
  });

  it('ignora eventos duplicados o atrasados', () => {
    expect(classifyRealtimeSequence(42, 42)).toBe('ignore');
    expect(classifyRealtimeSequence(42, 9)).toBe('ignore');
  });

  it('solicita reconciliación ante un salto de secuencia', () => {
    expect(classifyRealtimeSequence(42, 44)).toBe('reconcile');
  });

  it('clasifica una carga sostenida conservando el orden', () => {
    let current = 0;
    for (let sequence = 1; sequence <= 100_000; sequence += 1) {
      expect(classifyRealtimeSequence(current, sequence)).toBe('accept');
      current = sequence;
    }
    expect(current).toBe(100_000);
  });
});
