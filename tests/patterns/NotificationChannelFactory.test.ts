import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { EmailChannel, NotificationChannelFactory, SmsChannel } from '../../src/patterns/NotificationChannelFactory';

const factory = () => new NotificationChannelFactory(pino({ level: 'silent' }));

describe('NotificationChannelFactory', () => {
  it('creates the right channel and reuses instances', () => {
    const f = factory();
    expect(f.create('email')).toBeInstanceOf(EmailChannel);
    expect(f.create('sms')).toBeInstanceOf(SmsChannel);
    expect(f.create('email')).toBe(f.create('email'));
    expect(f.create('push').name).toBe('push');
    expect(f.create('log').name).toBe('log');
  });

  it('validates destinations per channel', async () => {
    const f = factory();
    const msg = { subject: 's', body: 'b' };
    expect((await f.create('email').send({ ...msg, to: 'a@b.co' })).ok).toBe(true);
    expect((await f.create('email').send({ ...msg, to: 'nope' })).ok).toBe(false);
    expect((await f.create('sms').send({ ...msg, to: '+57 300 123 4567' })).ok).toBe(true);
    expect((await f.create('sms').send({ ...msg, to: 'abc' })).ok).toBe(false);
  });

  it('throws on unknown channels', () => {
    expect(() => factory().create('fax' as never)).toThrow();
  });
});
