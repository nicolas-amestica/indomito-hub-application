import { describe, expect, it } from 'vitest';

import { constrainImageDimensions } from './prepare-profile-image';

describe('constrainImageDimensions', () => {
  it('mantiene una imagen que ya cabe en el límite', () => {
    expect(constrainImageDimensions(1200, 900)).toEqual({ width: 1200, height: 900 });
  });

  it('reduce una imagen horizontal conservando su proporción', () => {
    expect(constrainImageDimensions(8000, 6000)).toEqual({ width: 2560, height: 1920 });
  });

  it('reduce una imagen vertical conservando su proporción', () => {
    expect(constrainImageDimensions(3000, 6000)).toEqual({ width: 1280, height: 2560 });
  });
});
