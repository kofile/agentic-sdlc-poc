// Ticket loader for G (spec 006 R2a). Opens ONLY <ticketsRoot>/<id>/ticket.md: nothing else in the
// ticket directory is read (benchmark integrity).
import fs from 'node:fs';
import path from 'node:path';

export interface GTicket {
  id: string;
  title: string;
  description: string;
  labels: string[];
}

/** Parse ticket markdown: the first H1 is the title, everything after it is the description. */
export function parseTicket(id: string, markdown: string): GTicket {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const h1 = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (h1 < 0) throw new Error(`ticket ${id}: ticket.md has no "# Title" heading`);
  const title = lines[h1].replace(/^#\s+/, '').trim();
  const description = lines.slice(h1 + 1).join('\n').trim();
  return { id, title, description, labels: [] };
}

export function loadTicket(ticketsRoot: string, id: string): GTicket {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`invalid ticket id "${id}"`);
  const file = path.join(ticketsRoot, id, 'ticket.md');
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`ticket ${id}: cannot read ${file}`);
  }
  return parseTicket(id, text);
}
