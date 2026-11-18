import bcrypt from 'bcryptjs';
import type { Repos } from './repositories/Repos';

export const DEMO_EMAIL = 'demo@episafe.app';
export const DEMO_PASSWORD = 'Demo1234!';

/**
 * Datos de demostración para el modo en memoria (sin PostgreSQL).
 * Con PostgreSQL el seed lo aporta el repo EpisafeIa_BD.
 */
export async function seedDemoData(repos: Repos, rounds = 10, now = new Date()): Promise<string> {
  const user = await repos.users.insert({
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, rounds),
    fullName: 'Usuario Demo',
    birthDate: '1995-06-15',
    timezone: 'America/Bogota',
    role: 'patient',
    createdAt: now.toISOString(),
  });

  await repos.contacts.insert({
    userId: user.id, name: 'Contacto Principal', relationship: 'familiar', phone: '+57 300 000 0001',
    email: 'contacto@example.com', priority: 1, notifySms: true, notifyEmail: true,
  });
  await repos.medications.insert({
    userId: user.id, name: 'Levetiracetam', dose: '500', unit: 'mg', scheduleTimes: ['08:00', '20:00'], active: true, notes: null,
  });

  // 60 días de hábitos; las crisis ocurren principalmente tras dormir menos de 5 h.
  for (let i = 60; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    const lowSleep = i % 9 === 0;
    await repos.dailyLogs.insert({
      userId: user.id, logDate: date, sleepHours: lowSleep ? 4 : 7 + (i % 3) * 0.5, stressLevel: lowSleep ? 8 : 3 + (i % 4),
      caffeineMg: 100 + (i % 5) * 40, exerciseMinutes: i % 2 ? 30 : 0, mood: 3 + (i % 3 === 0 ? 1 : 0), alcoholUnits: 0, notes: null,
    });
    if (lowSleep) {
      await repos.seizures.insert({
        userId: user.id, startedAt: `${date}T14:00:00.000Z`, durationSeconds: 60 + (i % 4) * 20, severity: 2 + (i % 3),
        seizureType: 'tónico-clónica', triggersNoted: ['falta de sueño', 'estrés'], location: null, notes: null, source: 'manual', resolvedAt: null,
      });
    }
  }
  return user.id;
}
