import { prisma } from '../db/prisma';

/**
 * Fortlaufende Belegnummern im Format R-JJJJ-NNNNNN.
 * Der Zähler wird atomar (DB-seitiges increment) hochgezählt, damit auch bei
 * parallelen Webhooks keine Doppelvergabe entsteht.
 */
export async function nextReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterName = `receipt-${year}`;

  const counter = await prisma.counter.upsert({
    where: { name: counterName },
    create: { name: counterName, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `R-${year}-${String(counter.value).padStart(6, '0')}`;
}
