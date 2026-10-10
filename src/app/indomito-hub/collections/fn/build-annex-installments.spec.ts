import { buildAnnexInstallments } from './build-annex-installments';

describe('buildAnnexInstallments', () => {
  it('preserves the agreed day and adjusts short months', () => {
    expect(buildAnnexInstallments('2028-01-31', 3, 100_000)).toEqual([
      { id: '0001', dueDate: '2028-01-31', amount: 100_000 },
      { id: '0002', dueDate: '2028-02-29', amount: 100_000 },
      { id: '0003', dueDate: '2028-03-31', amount: 100_000 },
    ]);
  });

  it('rejects incomplete or non-positive conditions', () => {
    expect(buildAnnexInstallments('', 2, 100)).toEqual([]);
    expect(buildAnnexInstallments('2027-02-30', 2, 100)).toEqual([]);
    expect(buildAnnexInstallments('2027-01-05', 0, 100)).toEqual([]);
    expect(buildAnnexInstallments('2027-01-05', 2, 0)).toEqual([]);
  });
});
