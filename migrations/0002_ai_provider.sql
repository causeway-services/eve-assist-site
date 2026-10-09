-- EVE Assist — provider-agnostic AI analyst (ROADMAP.md, 2026-08-05 decision).
-- Adds provider/base-url/model selection alongside the existing sealed-key
-- column. gemini_key_sealed and gemini_model are NOT renamed: D1/SQLite
-- migrations here are forward-only append (see 0001_init.sql's own
-- comment), and every column name pinned in a landed migration stays put —
-- gemini_key_sealed now holds the sealed key for whichever provider the row
-- names in ai_provider; the name is historical, not a claim about which
-- provider is in use.

ALTER TABLE user_settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'gemini';
ALTER TABLE user_settings ADD COLUMN ai_base_url TEXT;
ALTER TABLE user_settings ADD COLUMN ai_model TEXT;
