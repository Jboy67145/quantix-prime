-- Quantix Prime: remove the redundant ledger reference index.
-- quantix_ledger_entries.reference already has the unique constraint/index
-- quantix_ledger_entries_reference_key, so the extra index is unnecessary.
drop index if exists public.quantix_ledger_reference_unique_idx;
