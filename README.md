# Alistamiento Diario (HTML + CSS + JS + Supabase)

Migracion de la app que estaba en Apps Script hacia una app web cliente sin login.

## Archivos

- `index.html`: interfaz principal (formulario).
- `styles.css`: estilos responsive.
- `app.js`: logica de validaciones, consulta de conductores por CSV y guardado.
- `config.js`: configuracion de `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `supabase.sql`: esquema SQL, politicas RLS y datos iniciales.

## Puesta en marcha

1. En tu proyecto Supabase, abre SQL Editor y ejecuta `supabase.sql`.
2. Edita `config.js` con tu URL y tu anon key del proyecto.
3. Sirve esta carpeta como sitio estatico:
   - `python -m http.server 8080`
4. Abre `http://localhost:8080`.

## Envio a SICOV

El boton "Enviar Alistamiento" ahora hace 2 pasos:
1. Envia el payload al endpoint backend configurado en `config.js`:
   - `sicovDispatchUrl`
   - `sicovDispatchKey`
2. Solo si SICOV responde OK, guarda en `preoperacionales_sicov`.

Si SICOV falla, la UI muestra error y NO se guarda en Supabase.

### Edge Function requerida

El endpoint `sonar-dispatch` no usa el formato de alistamiento SICOV.  
Para esta app usa `supabase/functions/sicov-alistamiento/index.ts` y despliegala como:

- `sicov-alistamiento`

Configura secretos en Supabase Edge Functions:

- `SICOV_BASE_URL=https://sicov.calisoftware.com.co`
- `SICOV_NIT=...`
- `SICOV_PASSWORD=...`

## Datos esperados

- Los vehiculos estan integrados directamente en `app.js` (no requiere tabla `vehicles`).
- Los conductores se consultan desde el CSV publicado en `config.js` (`conductoresCsvUrl`).

## Flujo funcional

1. Selecciona interno y se completa placa.
2. El sistema valida si ese vehiculo ya tiene alistamiento en la jornada actual (corte diario 7:00 a. m. hora Bogota).
3. Escribe documento de conductor y se consulta en el CSV publicado.
4. Marca actividades.
5. Se envia a SICOV y solo si SICOV responde OK se guarda en `preoperacionales_sicov`.

## Nota de seguridad

- `anonKey` es publica por diseno, pero no reemplaza RLS.
- Esta version permite acceso `anon` para registrar sin login.
