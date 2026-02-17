-- Run this SQL in your Supabase SQL Editor

ALTER TABLE public.farms 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS plot_number text,
ADD COLUMN IF NOT EXISTS area_name text,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS plot_area_sqm double precision,
ADD COLUMN IF NOT EXISTS plot_length_m double precision,
ADD COLUMN IF NOT EXISTS plot_width_m double precision;
