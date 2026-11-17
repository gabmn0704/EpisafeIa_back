import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../../config/env';
import type { Role, User } from '../../domain/types';
import { ConflictError, TooManyRequestsError, UnauthorizedError } from '../../errors';
import type { Repos } from '../../repositories/Repos';
import { BloomFilter } from '../../structures/BloomFilter';
import { HashTable } from '../../structures/HashTable';
import type { AuditService } from '../../services/AuditService';
import type { LoginInput, RegisterInput } from './schemas';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

interface Attempts {
  count: number;
  lockedUntil: number;
}

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;

export const toPublicUser = (u: User): PublicUser => {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
};

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/**
 * Registro, login con bloqueo temporal, rotación de refresh tokens.
 * - BloomFilter de correos: descarta rápido correos que seguro no existen.
 * - BloomFilter de tokens revocados: evita consultar la BD con tokens válidos.
 * - HashTable de intentos fallidos por correo para el bloqueo temporal.
 */
export class AuthService {
  private emails = new BloomFilter(100_000, 0.001);
  private revoked = new BloomFilter(100_000, 0.001);
  private attempts = new HashTable<Attempts>();
  private warmed: Promise<void> | null = null;
  private readonly dummyHash: string;

  constructor(
    private readonly repos: Repos,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly now: () => number = Date.now,
  ) {
    this.dummyHash = bcrypt.hashSync('dummy-password-for-timing', config.bcryptRounds);
  }

  /** Carga en los filtros los correos y tokens revocados ya existentes (una vez). */
  warmUp(): Promise<void> {
    this.warmed ??= (async () => {
      for (const u of await this.repos.users.find()) this.emails.add(u.email);
      for (const t of await this.repos.refreshTokens.find({ where: { revoked: true } })) this.revoked.add(t.tokenHash);
    })();
    return this.warmed;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    await this.warmUp();
    if (this.emails.mightContain(input.email)) {
      const existing = await this.repos.users.findOne({ where: { email: input.email } });
      if (existing) throw new ConflictError('Ya existe una cuenta con ese correo');
    }
    const user = await this.repos.users.insert({
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, this.config.bcryptRounds),
      fullName: input.fullName,
      birthDate: input.birthDate ?? null,
      timezone: input.timezone ?? 'America/Bogota',
      role: 'patient',
      createdAt: new Date(this.now()).toISOString(),
    });
    this.emails.add(user.email);
    await this.audit.record(user.id, 'register', 'user', user.id);
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    await this.warmUp();
    const state = this.attempts.get(input.email);
    if (state && state.lockedUntil > this.now()) {
      throw new TooManyRequestsError('Cuenta bloqueada temporalmente por intentos fallidos');
    }
    const user = this.emails.mightContain(input.email)
      ? await this.repos.users.findOne({ where: { email: input.email } })
      : undefined;
    // Se compara siempre contra un hash para no filtrar si el correo existe por tiempos.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) {
      this.registerFailure(input.email);
      throw new UnauthorizedError('Correo o contraseña incorrectos');
    }
    this.attempts.delete(input.email);
    await this.audit.record(user.id, 'login', 'user', user.id);
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    await this.warmUp();
    const hash = sha256(refreshToken);
    if (this.revoked.mightContain(hash)) {
      const confirmed = await this.repos.refreshTokens.findOne({ where: { tokenHash: hash, revoked: true } });
      if (confirmed) throw new UnauthorizedError('Refresh token revocado');
    }
    const record = await this.repos.refreshTokens.findOne({ where: { tokenHash: hash } });
    if (!record || record.revoked || Date.parse(record.expiresAt) <= this.now()) {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }
    const user = await this.repos.users.get(record.userId);
    if (!user) throw new UnauthorizedError('Usuario no encontrado');
    await this.revokeRecord(record.id, hash);
    return this.issue(user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const hash = sha256(refreshToken);
    const record = await this.repos.refreshTokens.findOne({ where: { tokenHash: hash } });
    if (record && !record.revoked) await this.revokeRecord(record.id, hash);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repos.users.get(userId);
    if (!user) throw new UnauthorizedError('Usuario no encontrado');
    return toPublicUser(user);
  }

  private async revokeRecord(id: string, hash: string): Promise<void> {
    await this.repos.refreshTokens.update(id, { revoked: true });
    this.revoked.add(hash);
  }

  private registerFailure(email: string): void {
    const cur = this.attempts.get(email) ?? { count: 0, lockedUntil: 0 };
    cur.count += 1;
    if (cur.count >= MAX_FAILED_LOGINS) {
      cur.lockedUntil = this.now() + LOCK_MS;
      cur.count = 0;
    }
    this.attempts.set(email, cur);
  }

  signAccessToken(id: string, role: Role): string {
    return jwt.sign({ role }, this.config.jwtSecret, {
      subject: id,
      algorithm: 'HS256',
      expiresIn: this.config.accessTokenTtl as jwt.SignOptions['expiresIn'],
    });
  }

  private async issue(user: User): Promise<AuthResult> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.repos.refreshTokens.insert({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(this.now() + this.config.refreshTokenTtlDays * 86_400_000).toISOString(),
      revoked: false,
    });
    return { user: toPublicUser(user), accessToken: this.signAccessToken(user.id, user.role), refreshToken };
  }
}
