import type { AnnexInstallment } from '../interfaces/collection-annex.interface';

export function buildAnnexInstallments(
  firstDueDate: string,
  quantity: number,
  amount: number,
): AnnexInstallment[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 120 ||
    !Number.isSafeInteger(amount) ||
    amount < 1
  ) {
    return [];
  }
  const [year, month, day] = firstDueDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== firstDueDate) return [];
  return Array.from({ length: quantity }, (_, index) => {
    const targetMonth = month - 1 + index;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const due = new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
    return {
      id: String(index + 1).padStart(4, '0'),
      dueDate: due.toISOString().slice(0, 10),
      amount,
    };
  });
}
