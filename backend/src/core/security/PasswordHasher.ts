import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, length: number): Promise<Buffer> => new Promise((resolve, reject) => {
  scryptCallback(password, salt, length, { N: 32_768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, derivedKey) => {
    if (error) reject(error);
    else resolve(derivedKey);
  });
});

export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64);
    return `scrypt$32768$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, n, r, p, saltText, hashText, ...extra] = encoded.split('$');
    if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '1' || !saltText || !hashText || extra.length > 0) return false;
    try {
      const salt = Buffer.from(saltText, 'base64');
      const expected = Buffer.from(hashText, 'base64');
      if (salt.length !== 16 || expected.length !== 64) return false;
      const actual = await scrypt(password, salt, expected.length);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
