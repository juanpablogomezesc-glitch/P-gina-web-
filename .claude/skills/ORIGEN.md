# Origen de estas skills

Copiadas del repositorio https://github.com/emilkowalski/skills (Emil Kowalski, licencia MIT;
ver `LICENSE-emilkowalski-skills`). Se revisó el contenido antes de instalarlas: solo son
instrucciones en texto, sin comandos ni ganchos automáticos.

Para actualizarlas, volver a copiar la carpeta `skills/` del repositorio original.

Las que más se usan en este proyecto: `emil-design-eng`, `animate`, `review-animations`,
`mobile-native`, `break-ui`, `prototype` y `find-animation-opportunities`.
No aplican a una página web: `write-swift`, `animate-expo` (React Native) y `ask-sonner`
(librería de React). Se pueden borrar sin afectar al resto.

---

# Impeccable (diseño de interfaces)

Copiada del repositorio https://github.com/pbakaus/impeccable (Paul Bakaus, versión 4.5.0,
licencia Apache 2.0; ver `impeccable/LICENSE` y `impeccable/NOTICE.md`).

Es **una sola skill con 24 comandos** (`/impeccable audit`, `/impeccable critique`,
`/impeccable polish`, `/impeccable typeset`, `/impeccable colorize`, etc.).

Se instaló **solo la parte de texto** (`SKILL.md` y `reference/`). Se dejó afuera a propósito la
carpeta `scripts/` del original: su launcher descarga un programa ya compilado desde internet y lo
ejecuta, y ese programa no se puede revisar desde acá. Sin él, la skill sigue funcionando: su propio
plan B es leer `PRODUCT.md` y `DESIGN.md` del proyecto. Lo que no funciona sin los scripts:
el detector automático de errores de diseño, el modo `live` y los atajos `pin`/`hooks`.

Para instalar la versión completa, copiar también `scripts/` del repositorio original
(ver el riesgo descrito arriba antes de hacerlo).

---

# Taste Skill (solo `redesign-existing-projects`)

Copiada del repositorio https://github.com/Leonxlnx/taste-skill (Leonxlnx, licencia MIT; ver
`LICENSE-taste-skill`). Es una auditoría de diseño con lista de verificación para mejorar un sitio
que ya existe, sin cambiar de tecnología. Se revisó el contenido completo antes de instalarla.

Del repositorio se instaló **solo esta** de las 13 skills, porque las demás no suman a este proyecto:
- `taste-skill`, `taste-skill-v1`, `gpt-tasteskill`, `soft-skill`: se superponen con Emil e
  Impeccable y empujan hacia React, Tailwind y animaciones de scroll pesadas.
- `minimalist-skill`, `brutalist-skill`: proponen paletas y estilos que chocan con la marca
  (negro, gris y naranja).
- `image-to-code-skill`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `brandkit`:
  necesitan generación de imágenes.
- `stitch-skill`: es para la herramienta Google Stitch.
- `output-skill`: exige respuestas largas y completas; no hace falta.

**Ojo:** esta skill trae opiniones propias (por ejemplo, cambiar la tipografía o evitar los
subtítulos en mayúsculas). En este proyecto mandan las decisiones del dueño: paleta negro/gris/naranja,
Oswald para títulos e Inter para texto, y títulos en mayúsculas. Si una skill propone algo
distinto, se consulta antes de aplicarlo.
