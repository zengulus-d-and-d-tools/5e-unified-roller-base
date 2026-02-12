# Requisition Vault (`requisitions.html`)

Shared request queue for items, approvals, and follow-through.

## Layout

- **Request Form**: item, requester, group/source, priority, status, value, image URL, purpose, notes, tags.
- **Filters**: search + status + group + priority.
- **Cards**: inline editable fields with board/timeline navigation and delete.

## Behavior

- Saves to shared `RTF_STORE` (`campaign.requisitions`).
- Sorted by priority, then creation time.
- Uses soft-delete with undo timeout when available.

## Integrations

- `Board` action opens linked case board context.
- `Timeline` action opens timeline with prefilled search/focus parameters.

## Tips

- Keep tags short and consistent (`alchemy`, `legal`, `transport`).
- Use `Purpose` for why the request matters; use `Notes` for process/state details.
