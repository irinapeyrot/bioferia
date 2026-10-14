# Bioferia · Landing

Landing de Bioferia BA 2027 con recorrido en profundidad: al scrollear, la cámara avanza siguiendo un círculo que abre cada sección como un mundo de color.

Propuesta de identidad de Trazo · Proyecto Final de Tesis · Diseño Gráfico · Escuela Da Vinci.

## Cómo verla
Abrí `index.html` en el navegador. No necesita instalar nada: es HTML, CSS y JavaScript en un solo archivo, con las fotos y los logos incrustados.

## Deploy en Vercel
1. En Vercel, **Add New → Project** e importá este repositorio.
2. Framework Preset: **Other**. Sin comando de build. Output: la raíz del proyecto.
3. Deploy.

Para que se vea **Articulat CF**, el proyecto web de Adobe Fonts (`pew4vhe`) tiene que permitir el dominio del sitio.

## Estructura
- `index.html` — toda la landing.
- `assets/logos/` — logos vectorizados en un color (OSDE, Gestiones Solidarias, Buenos Aires Ciudad).
- `assets/tramas/` — fotos de las tramas de Trazo Lab (Destellos, Yuca, Palma, Esporas, Cañón). Se usan de fondo en cada estación, detrás del mapa topográfico y bajo un velo del color del mundo; la animación usa el mismo motor WebGL de Trazo Lab, portado dentro de `index.html`.

Para probarla en local hace falta un servidor (por ejemplo `python3 -m http.server`), porque WebGL no puede leer fotos abiertas como archivo.
