-- ============================================================================
-- Themed balance invoices
--
-- Adds an `invoice_theme` slug to the parties table. The admin picks a theme
-- (hot_wheels, princess, dinosaurs, superheroes, frozen, jungle, wonderland)
-- before sending the balance invoice; lib/invoice-themes.ts owns the actual
-- visual config (gradient, emoji art, eyebrow label) and the branded email
-- renders accordingly.
-- ============================================================================

alter table parties
  add column if not exists invoice_theme text not null default 'wonderland';
