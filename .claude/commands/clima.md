---
name: clima
description: Toma la medición actual del clima (temperatura, humedad, viento, precipitación) para una ciudad o coordenadas desde la terminal, usando Open-Meteo (sin API key). Úsala cuando pidan "clima", "temperatura", "medición del clima" o /clima.
argument-hint: "[ciudad | lat,lon]"
allowed-tools: Bash(curl *), Bash(python3 *)
---

# Medición del clima

Obtiene las condiciones actuales con la API pública de Open-Meteo (sin clave, sin registro).

## Pasos

1. Determina la ubicación a partir de `$ARGUMENTS`:
   - Si son coordenadas (`lat,lon`), úsalas directamente.
   - Si es un nombre de ciudad, geocodifícalo:
     ```bash
     curl -s --get "https://geocoding-api.open-meteo.com/v1/search" \
       --data-urlencode "name=CIUDAD" -d count=1 -d language=es -d format=json
     ```
     Toma `results[0].latitude`, `longitude`, `name` y `country`. Si `results` no existe, dilo y pide otra ubicación.
   - Si no hay argumento, pregunta la ciudad. No adivines ni envíes datos personales del usuario (nombre, email, etc.); solo se envía la ciudad o las coordenadas.

2. Consulta las condiciones actuales:
   ```bash
   curl -s --get "https://api.open-meteo.com/v1/forecast" \
     -d latitude=LAT -d longitude=LON -d timezone=auto \
     -d current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code
   ```
   Las unidades vienen en `current_units`; el instante en `current.time` (hora local de la ubicación).

3. Presenta un resumen breve en español: ubicación, hora de la medición, temperatura (y sensación térmica), humedad, viento (velocidad y dirección), precipitación y una descripción del `weather_code` (WMO: 0 despejado, 1-3 nublado parcial/total, 45-48 niebla, 51-67 llovizna/lluvia, 71-77 nieve, 80-82 chubascos, 95-99 tormenta).

## Errores

- Si `curl` falla o la respuesta trae `"error": true`, muestra el campo `reason` y no inventes valores.
- Sin conexión a internet no hay medición posible; indícalo claramente.
