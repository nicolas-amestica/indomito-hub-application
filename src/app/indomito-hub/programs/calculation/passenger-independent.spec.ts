import type { CrewInput, ServiceInput } from '../types/calculation.types';
import { isPassengerIndependent } from './passenger-independent';

const CREW: CrewInput = {
  name: 'Coordinador',
  documentId: '12345678',
  dailyPrice: 45_000,
  currency: 'CLP',
};

function service(chargeType: ServiceInput['chargeType']): ServiceInput {
  return { name: 'Servicio', chargeType, unitPrice: 100, currency: 'USD' };
}

describe('isPassengerIndependent', () => {
  it('incluye tripulación y servicios fijos o por día', () => {
    expect(isPassengerIndependent(CREW)).toBe(true);
    expect(isPassengerIndependent(service('fixed'))).toBe(true);
    expect(isPassengerIndependent(service('per_day'))).toBe(true);
  });

  it('excluye los tres tipos cuyo costo multiplica pasajeros', () => {
    expect(isPassengerIndependent(service('per_passenger'))).toBe(false);
    expect(isPassengerIndependent(service('per_passenger_night'))).toBe(false);
    expect(isPassengerIndependent(service('per_passenger_day'))).toBe(false);
  });
});
