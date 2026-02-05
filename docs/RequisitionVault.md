# Requisition Vault (`requisitions.html`)

Shared inventory pipeline for the Task Force. Use it to triage kit requests, track approvals, and keep the squad aligned on who owes what paperwork.

## Views
- **Request Grid** – Cards show item, requester, guild/source, priority, and current status. Everything is editable inline.
- **Filters & Search** – Narrow the list by guild, status, or priority. The free-text search sweeps item names, purposes, notes, and tags.
- **Quick Add Form** – Log a new pull request with requester, source guild, priority, estimated value, and justification.

## Workflow
1. **Log the request** as soon as it’s made. Include notes on where the gear comes from and any complications.
2. **Tag priority/status** to bubble emergencies to the top. The priority selector auto-sorts cards (Emergency > Tactical > Routine).
3. **Update fields in place** (status, guild, requester, notes, tags). Edits auto-save via Local Storage and the unified store.
4. **Archive/Delete** once gear is delivered or denied to keep the queue lean.

## Tips
- Use tags such as `chem`, `intel`, `legal` to make future filtering painless.
- The requester field supports free text—log both agent callsigns and outside contacts.
- Export from `tools.html` to snapshot requisition history before downtime reviews.
