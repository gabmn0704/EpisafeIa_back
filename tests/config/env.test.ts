import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env';
import { ConfigProvider } from '../../src/patterns/Singleton';

const base = { JWT_SECRET: 'x'.repeat(32) };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.port).toBe(4000);
    expect(c.corsOrigins).toEqual(['http://localhost:5173']);
    expect(c.databaseUrl).toBeUndefined();
    expect(c.aiServiceUrl).toBe('http://localhost:5000');
  });

  it('parses lists and numbers and trims trailing slash', () => {
    const c = loadConfig({
      ...base,
      CORS_ORIGINS: 'http://a.com, http://b.com',
      PORT: '8080',
      AI_SERVICE_URL: 'http://ai:5000/',
    });
    expect(c.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
    expect(c.port).toBe(8080);
    expect(c.aiServiceUrl).toBe('http://ai:5000');
  });

  it('rejects short secrets', () => {
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});

describe('ConfigProvider (Singleton)', () => {
  it('returns the same instance until reset', () => {
    ConfigProvider.reset();
    const a = ConfigProvider.getInstance(base);
    const b = ConfigProvider.getInstance({ JWT_SECRET: 'y'.repeat(40) });
    expect(a).toBe(b);
    ConfigProvider.reset();
    expect(ConfigProvider.getInstance({ JWT_SECRET: 'y'.repeat(40) })).not.toBe(a);
    ConfigProvider.reset();
  });
});
