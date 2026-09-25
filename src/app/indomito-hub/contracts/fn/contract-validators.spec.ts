import { birthDateValidator, isValidChileanRut } from './contract-validators';

describe('contract validators', () => {
  it('valida el dígito verificador del RUT', () => {
    expect(isValidChileanRut('12.345.678-5')).toBe(true);
    expect(isValidChileanRut('12.345.678-9')).toBe(false);
  });

  it('rechaza fechas inexistentes y futuras', () => {
    expect(birthDateValidator({ value: '2010-02-30' } as never)).toEqual({ birthDate: true });
    expect(birthDateValidator({ value: '2099-01-01' } as never)).toEqual({ birthDate: true });
    expect(birthDateValidator({ value: '2010-02-28' } as never)).toBeNull();
  });
});
