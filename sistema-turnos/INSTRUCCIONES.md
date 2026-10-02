# Sistema de turnos: cómo ponerlo en marcha

Los turnos se guardan en una planilla de Google que es tuya. La página de turnos
(`turnos.html`) lee los horarios de esa planilla y guarda ahí cada reserva.

Lleva unos 10 minutos y se hace una sola vez.

## 1. Crear la planilla

1. Entrá a [sheets.google.com](https://sheets.google.com) y creá una planilla en blanco.
2. Ponele un nombre, por ejemplo **Turnos · JP Entrenamiento**.

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
3. Volvé a la planilla: vas a ver cuatro pestañas nuevas.

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
   - **Quién tiene acceso**: Cualquier usuario
4. Tocá **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
5. Pasale esa URL a Claude para conectarla con la página.

## 6. Último paso, cuando la página esté publicada

En la pestaña **Configuración**, en *Página de turnos (URL)*, pegá la dirección de tu página de
turnos (por ejemplo `https://juanpablogomezesc-glitch.github.io/P-gina-web-/turnos.html`).
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
