import fc from 'fast-check';

import { arbService } from '../calculation/__arbitraries__';
import { buildProgramForm, duplicateService } from './program-form.builder';

describe('duplicateService · propiedades', () => {
  it('Feature: program-form, Property 21: Duplicar un servicio reproduce todos sus valores', () => {
    fc.assert(
      fc.property(arbService(), (service) => {
        let nextId = 0;
        const idFactory = () => `service-${++nextId}`;
        const services = buildProgramForm(idFactory).controls.services;
        services.at(0).patchValue(service);
        const original = services.at(0).getRawValue();
        const previousLength = services.length;

        expect(duplicateService(services, 0, idFactory)).toBe(true);

        const duplicate = services.at(services.length - 1).getRawValue();
        expect(services.length).toBe(previousLength + 1);
        expect(duplicate.id).not.toBe(original.id);
        expect({ ...duplicate, id: original.id }).toEqual(original);
      }),
      { numRuns: 100 },
    );
  });
});
