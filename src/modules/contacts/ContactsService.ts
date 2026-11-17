import type { EmergencyContact } from '../../domain/types';
import { ownedOrNotFound } from '../../http/ownership';
import type { Repos } from '../../repositories/Repos';
import type { ContactCreate, ContactUpdate } from './schemas';

export class ContactsService {
  constructor(private readonly repos: Repos) {}

  /** Ordenados por prioridad (1 = se notifica primero). */
  list(userId: string): Promise<EmergencyContact[]> {
    return this.repos.contacts.find({ where: { userId }, orderBy: 'priority' });
  }

  create(userId: string, input: ContactCreate): Promise<EmergencyContact> {
    return this.repos.contacts.insert({
      userId,
      name: input.name,
      relationship: input.relationship ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      priority: input.priority,
      notifySms: input.notifySms,
      notifyEmail: input.notifyEmail,
    });
  }

  async update(userId: string, id: string, input: ContactUpdate): Promise<EmergencyContact> {
    ownedOrNotFound(await this.repos.contacts.get(id), userId, 'Contacto');
    const updated = await this.repos.contacts.update(id, input);
    return ownedOrNotFound(updated, userId, 'Contacto');
  }

  async remove(userId: string, id: string): Promise<void> {
    ownedOrNotFound(await this.repos.contacts.get(id), userId, 'Contacto');
    await this.repos.contacts.delete(id);
  }
}
