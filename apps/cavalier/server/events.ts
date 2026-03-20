/**
 * CVG-CAVALIER — Event Bus
 *
 * Simple event emitter for PSA events. In production,
 * events are forwarded to BullMQ queues for async processing.
 */
import type { PsaEvent } from '@cavaridge/psa-core';

type EventHandler = (event: PsaEvent) => void;

class PsaEventBus {
  private handlers: EventHandler[] = [];

  emit(event: PsaEvent): void {
    console.log(`[cavalier:event] ${event.type} tenant=${event.tenantId}`);
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[cavalier:event] Handler error:`, err);
      }
    }
  }

  on(handler: EventHandler): void {
    this.handlers.push(handler);
  }
}

export const eventBus = new PsaEventBus();

// Log ticket lifecycle events
eventBus.on((event) => {
  if (event.type === 'ticket.sla.breached') {
    console.warn(`[cavalier:sla] BREACH — tenant=${event.tenantId}`, event.payload);
  }
});
