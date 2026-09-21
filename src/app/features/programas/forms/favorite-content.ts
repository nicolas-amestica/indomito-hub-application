import type { FavoriteContent } from '../interfaces/favorite.interface';
import type { Program } from '../interfaces/program.interface';

/** Proyecta un programa al contrato persistible, sin totales ni snapshot de tasas. */
export function favoriteContentFromProgram(program: Program): FavoriteContent {
  return {
    generals: program.generals,
    schedule: {
      startDate: program.schedule.startDate,
      endDate: program.schedule.endDate,
      totalNights: program.schedule.totalNights,
      totalPassengers: program.schedule.totalPassengers,
      freePassengers: program.schedule.freePassengers,
    },
    pricing: {
      usdIncreaseCLP: program.pricing.usdIncreaseCLP,
      brlIncreaseCLP: program.pricing.brlIncreaseCLP,
      utilityRate: program.pricing.utilityRate,
      rechargeRate: program.pricing.rechargeRate,
    },
    crews: program.crews.map(({ name, documentId, dailyPrice, currency }) => ({
      name,
      documentId,
      dailyPrice,
      currency,
    })),
    services: program.services.map(({ name, chargeType, unitPrice, currency }) => ({
      name,
      chargeType,
      unitPrice,
      currency,
    })),
  };
}
