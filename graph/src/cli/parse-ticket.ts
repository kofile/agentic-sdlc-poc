import fs from 'node:fs';
import path from 'node:path';
import { TicketSchema, type Ticket } from '../core/schemas.ts';

/** Minimal Markdown ticket parser: first `# Title` line is the title, `Id:` / `Component:` /
 * `Labels:` lines (optional) set those fields, everything else is the description. Good
 * enough for a walking skeleton's sample tickets; not a general Jira import. */
export function parseTicketFile(filePath: string): Ticket {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  let title = path.basename(filePath, path.extname(filePath));
  let id = title.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  let component: string | undefined;
  const labels: string[] = [];
  const body: string[] = [];
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) { title = h1[1].trim(); continue; }
    const idM = line.match(/^Id:\s*(.+)/i);
    if (idM) { id = idM[1].trim(); continue; }
    const compM = line.match(/^Component:\s*(.+)/i);
    if (compM) { component = compM[1].trim(); continue; }
    const labelsM = line.match(/^Labels:\s*(.+)/i);
    if (labelsM) { labels.push(...labelsM[1].split(',').map((s) => s.trim()).filter(Boolean)); continue; }
    body.push(line);
  }
  return TicketSchema.parse({ id, title, description: body.join('\n').trim(), component, labels });
}
