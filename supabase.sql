-- Ejecuta este script en Supabase SQL Editor.
-- Estructura alineada al archivo:
-- PREOPERACIONALES 700 NUEVA SICOV.xlsx (hoja SICOV)
-- Fecha de referencia: 2026-04-06

create extension if not exists pgcrypto;

-- Tabla final con estructura operativa equivalente a la del Excel SICOV.
create table if not exists public.preoperacionales_sicov (
  id bigint generated always as identity primary key,
  created_by uuid null default auth.uid() references auth.users(id),
  "FechaHora" timestamptz not null default now(),
  "NumeroInterno" text null,
  "Placa" text not null,
  "Documento" text not null,
  "NombreConductor" text not null,
  "FugasMotor" smallint not null default 0 check ("FugasMotor" in (0,1)),
  "TensionCorreas" smallint not null default 0 check ("TensionCorreas" in (0,1)),
  "AjusteTapas" smallint not null default 0 check ("AjusteTapas" in (0,1)),
  "NivelesAceite" smallint not null default 0 check ("NivelesAceite" in (0,1)),
  "Limpiaparabrisas" smallint not null default 0 check ("Limpiaparabrisas" in (0,1)),
  "AditivosRadiador" smallint not null default 0 check ("AditivosRadiador" in (0,1)),
  "Filtros" smallint not null default 0 check ("Filtros" in (0,1)),
  "Bateria" smallint not null default 0 check ("Bateria" in (0,1)),
  "Llantas" smallint not null default 0 check ("Llantas" in (0,1)),
  "EquipoCarretera" smallint not null default 0 check ("EquipoCarretera" in (0,1)),
  "Botiquin" smallint not null default 0 check ("Botiquin" in (0,1)),
  "DetalleActividades" text not null default 'Alistamiento Web - Supabase',
  "EstadoEnvio" text not null default 'OK',
  "RespuestaSICOV" text null,
  "ErrorSheet" text null
);

alter table public.preoperacionales_sicov enable row level security;

drop policy if exists "preops_select_public" on public.preoperacionales_sicov;
create policy "preops_select_public"
on public.preoperacionales_sicov for select
to anon, authenticated
using (true);

drop policy if exists "preops_insert_public" on public.preoperacionales_sicov;
create policy "preops_insert_public"
on public.preoperacionales_sicov for insert
to anon, authenticated
with check (true);
