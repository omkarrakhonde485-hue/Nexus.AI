-- 011_google_connections_metadata.sql
-- Adds metadata column to store connection-level state like NEXUS root Drive folder ID

ALTER TABLE public.google_connections 
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
