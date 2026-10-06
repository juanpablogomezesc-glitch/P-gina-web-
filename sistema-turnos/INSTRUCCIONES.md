# Sistema de turnos: cómo ponerlo en marcha

Los turnos se guardan en una planilla de Google que es tuya. La página de turnos
(`turnos.html`) lee los horarios de esa planilla y guarda ahí cada reserva.

Lleva unos 10 minutos y se hace una sola vez.

## 1. La planilla

Si Claude ya creó la planilla en tu Drive, se llama **Turnos · JP Entrenamiento**: abrila y seguí con el
paso 2. Si no, entrá a [sheets.google.com](https://sheets.google.com), creá una planilla en blanco y
ponele ese nombre.

## 2. Pegar el código

1. En la planilla, andá a **Extensiones → Apps Script**. Se abre una pestaña nueva.
2. Borrá todo lo que aparece en el archivo `Código.gs`.
3. Copiá **todo** el contenido del archivo `sistema-turnos/Codigo.gs` de este repositorio y pegalo ahí.
4. Tocá el ícono de **guardar** (el disquete).

## 3. Crear las pestañas

1. Arriba, en la lista de funciones, elegí **configurar** y tocá **Ejecutar**.
2. Google te va a pedir permiso:
   - Tocá **Revisar permisos** y elegí tu cuenta.
   - Va a decir *"Google no verificó esta app"*. Es normal: la app es tuya y no está publicada.
     Tocá **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**.
   - Los permisos son para leer y escribir en esta planilla y mandar mails desde tu cuenta.
3. Volvé a la planilla: vas a ver cuatro pestañas nuevas (Horarios, Días sin clases, Reservas y
   Configuración). La pestaña vacía que venía de fábrica ("Hoja 1") la podés borrar.
   Si volvés a ejecutar `configurar` más adelante no pasa nada: no pisa tus datos, solo repara los formatos.

## 4. Cargar tus horarios

- **Horarios**: una fila por turno que se repite cada semana: `Día` (Lunes, Martes…), `Hora` (18:00) y `Cupo` (4).
  Hay ejemplos cargados: reemplazalos por tus horarios reales.
- **Días sin clases**: feriados o días que no das clase. Con la hora vacía se suspende todo el día;
  con una hora, solo ese turno. Formato de fecha: `2026-12-25`.
- **Configuración**: las reglas. Ya vienen como las pediste: se muestran 7 días, se reserva hasta
  2 horas antes, se cancela hasta 1 hora antes y máximo 4 lugares por persona.
- **Reservas**: no hace falta tocarla, se completa sola.

## 5. Publicar el sistema

1. En Apps Script, arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje de "Tipo", elegí **Aplicación web**.
3. Completá:
   - **Ejecutar como**: Yo
   - **Quién tiene acceso**: **Cualquier usuario** (la opción que NO pide iniciar sesión con Google).
     Si elegís la de "Cualquier usuario con cuenta de Google", tus alumnos no van a poder reservar.
4. Tocá **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
5. Pasale esa URL a Claude para conectarla con la página.

## 6. Último paso, cuando la página esté publicada

En la pestaña **Configuración**, en *Página de turnos (URL)*, pegá la dirección de tu página de
turnos (por ejemplo `https://juanpablogomezesc-glitch.github.io/P-gina-web-/turnos.html`).
Para publicar la página: en GitHub, **Settings → Pages → Deploy from a branch → rama `claude/crear-pagina-web-lvrwk8` → `/ (root)` → Save**.
Con eso, el mail de confirmación incluye el enlace para cancelar.

---

## Uso diario

| Quiero… | Qué hago |
| --- | --- |
| Agregar o sacar un horario | Agrego o borro la fila en **Horarios**. |
| Cambiar el cupo de un horario | Cambio el número en la columna **Cupo**. |
| Suspender un día o un turno | Agrego la fecha (y la hora, si es un solo turno) en **Días sin clases**. |
| Ver quién viene | Miro la pestaña **Reservas** (podés filtrar por fecha). |
| Cancelar una reserva a mano | En **Reservas**, cambio el **Estado** a `Cancelada`. El lugar se libera solo. |
| Recibir un mail con cada reserva | En **Configuración**, pongo `Sí` en *Avisarme cada reserva*. |

Los cambios en la planilla se ven en la página al instante, sin volver a publicar nada.

## Bueno saber

- **Mails**: salen desde tu cuenta de Gmail. Google limita la cantidad de mails por día en las cuentas
  gratuitas (alrededor de 100). Cada reserva usa uno, y uno más si activaste los avisos para vos.
- **Si se cambia el código** (por ejemplo, para agregar una función nueva): pegar el código nuevo y
  después ir a **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**.
  La URL no cambia.
- **Dos personas a la vez**: el sistema reserva de a una, así que nunca se pasa del cupo.

---

## Seguridad: qué puede y qué no puede hacer este sistema

- **El código corre en los servidores de Google, no en tu computadora.** Quien visite la página no
  toca tu computadora en ningún momento.
- **Permisos limitados a una sola planilla.** El código lleva la marca `@OnlyCurrentDoc`: solo puede
  leer y escribir en la planilla "Turnos · JP Entrenamiento", no en tus otras planillas ni en tu Drive.
  También puede mandar mails con tu cuenta, que es lo que usa para las confirmaciones.
- **No hace pedidos a otros sitios de internet, no abre tu Gmail y no instala nada.**
- **Los datos de tus alumnos (nombre y mail) quedan solo en tu planilla**, que es privada. Ninguna
  dirección del sistema devuelve la lista de reservas: cada reserva solo se consulta con su código secreto.
- **Límites contra abuso.** La dirección del sistema es pública, así que alguien podría intentar llenar
  los horarios con reservas falsas. El código frena: más de 5 reservas por hora de una misma persona,
  más de 40 por hora entre todas, y más de 12 reservas pendientes de una misma persona. Además deja
  de mandar mails de confirmación si queda poca cuota diaria de Gmail. Si igual pasara, podés
  cancelar reservas cambiando el Estado a `Cancelada` en la planilla.

**Lo que más te protege a vos** (más que cualquier código):
1. Activá la **verificación en dos pasos** en tu cuenta de Google y en tu cuenta de GitHub.
2. No des acceso de "editor" de la planilla a nadie que no sea de confianza.
3. No instales programas ni abras archivos que no esperabas.

## Cómo actualizar el código cuando cambia

1. Copiá el código nuevo (mismo enlace de siempre) y pegalo en Apps Script, reemplazando todo. Guardá.
2. **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.**
   La dirección `/exec` no cambia.
3. Si el código pide un permiso nuevo o más acotado, Google te va a pedir autorizar de nuevo. Aceptá.

---

## Si no llegan los mails de confirmación

1. En Apps Script, elegí la función **probarMail** y tocá **Ejecutar**. Te manda un mail de prueba a tu casilla.
   Si Google pide permisos, aceptalos (es el permiso de "enviar mails").
2. Si falla, el motivo exacto aparece abajo, en el **Registro de ejecución**.
3. Para ver qué pasó en reservas anteriores, abrí **Ejecuciones** (ícono de lista, menú izquierdo).
   Ahí aparece cada reserva; si el mail falló, el motivo está en el registro.
4. Revisá la carpeta de **spam** del mail con el que se reservó.
5. Después de autorizar, **actualizá la implementación** (Implementar → Gestionar implementaciones → lápiz →
   Nueva versión → Implementar). Un permiso nuevo hay que autorizarlo antes de implementar.

Si el mail no puede salir, la página ahora lo dice y le muestra al alumno su código de reserva.

---

## Google Calendar: las clases en tu calendario

**Qué hace:** crea un calendario propio llamado **Turnos JP** (aparece a la izquierda en Google Calendar,
en "Mis calendarios") y, por cada persona que reserva, **una casilla con su nombre** a la hora de la clase.
Las casillas de un mismo horario se ven una al lado de la otra, así contando casillas sabés cuántos van:

> 18:00 · **Ana Pérez (2)** · **Beto Gómez** · **Caro Díaz**

- Si una persona reservó más de un lugar, lo dice al lado del nombre: **Ana Pérez (2)**.
- La casilla se actualiza o desaparece sola cuando alguien cancela.
- Los alumnos, además, reciben en su mail un enlace **"Agregar a mi Google Calendar"** (usa su propio
  calendario; no necesita ningún permiso tuyo).

**Cómo activarlo (una sola vez):**
1. Pegá el código nuevo en Apps Script y guardá.
2. Elegí la función **`probarCalendario`** y tocá **Ejecutar**. Google va a pedir un permiso nuevo
   (ver más abajo). Aceptalo. En el registro tiene que decir *Calendario listo*.
3. Elegí **`configurar`** y tocá **Ejecutar** otra vez: agrega a la pestaña **Configuración** dos filas nuevas
   ("Calendario de Google (nombre)" y "Duración de la clase (minutos)") sin tocar nada de lo que ya tenías.
4. **Implementar → Gestionar implementaciones → lápiz → Nueva versión → Implementar.**

**Opciones (pestaña Configuración):**
- *Calendario de Google (nombre)*: dejalo vacío (o poné `No`) para no usar el calendario.
  Si querés que las clases aparezcan en otro calendario tuyo, poné su nombre exacto.
- *Duración de la clase (minutos)*: cuánto ocupa cada evento (por defecto 60).

**Si cambiás reservas a mano en la planilla** (por ejemplo, un Estado a `Cancelada`): elegí la función
**`sincronizarTodo`** y Ejecutar, y el calendario se vuelve a armar con lo que dice la planilla.

**Sobre el permiso que pide Google (importante):** el permiso de calendario de Google se describe como
*"ver, editar, compartir y eliminar todos los calendarios a los que podés acceder"*. Es el único que Google
ofrece para esto: no se puede limitar a un solo calendario. El código solo usa el calendario **Turnos JP**
y solo borra casillas que él mismo creó (las reconoce por una marca). Podés verificarlo: en `Codigo.gs`
buscá `CalendarApp`; aparece solo en la sección "Google Calendar".
No agrega a los alumnos como invitados (así no ven los mails de los demás ni les llegan invitaciones),
y en el evento solo figura el nombre de cada persona, no mails ni teléfonos ni cantidad de lugares.
Si no querés darle ese permiso, no ejecutes `probarCalendario` y poné la opción vacía: el turnero sigue
funcionando igual, sin calendario.
