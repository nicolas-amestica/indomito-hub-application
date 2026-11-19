const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Genera un ULID local para identificar partidas y comandos antes de persistir. */
export function balanceId(): string {
  let time = Date.now();
  let prefix = '';
  for (let index = 0; index < 10; index++) {
    prefix = ALPHABET[time % 32] + prefix;
    time = Math.floor(time / 32);
  }
  return (
    prefix +
    [...crypto.getRandomValues(new Uint8Array(16))].map((value) => ALPHABET[value & 31]).join('')
  );
}
