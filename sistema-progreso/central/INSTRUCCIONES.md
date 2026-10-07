# Script central del dashboard: paso a paso

Se instala **una sola vez**. Las planillas de los alumnos no llevan ningún código: el script central las lee y le entrega a la página solo los datos de cada alumno.

## Cómo funciona
- Cada alumno tiene un **link personal** (por ejemplo `.../progreso.html?c=AbCd...`). La parte `c=` es una clave secreta de 24 caracteres: funciona como una contraseña. Quien no tenga el link no ve nada.
- El script lee las pestañas "Semana N" (desde la más nueva hacia atrás, hasta que aparece una con el formato viejo) y el calendario "Asistencia AAAA".
- Solo devuelve los 4 ejercicios del dashboard, las fechas de asistencia y los objetivos. No devuelve emails, ni el ID de la planilla, ni nada de otros alumnos.

## Qué permisos pide, y por qué
El script necesita abrir las planillas de tus alumnos, así que Google te va a pedir permiso para **ver y editar tus hojas de cálculo**. El código solo las **lee** (no escribe en ninguna planilla de alumno). Aparece "Google no verificó esta aplicación": es normal, el código es tuyo.

## 1. Pegar el código
1. Abrí la planilla **"Progreso · JP Entrenamiento"** (está en tu Drive).
2. **Extensiones > Apps Script**.
3. Abrí este link, que muestra el archivo completo como texto: `https://raw.githubusercontent.com/juanpablogomezesc-glitch/P-gina-web-/claude/crear-pagina-web-lvrwk8/sistema-progreso/central/Central.gs`
4. Clic en la página, **Ctrl + A**, **Ctrl + C**.
5. En Apps Script: clic en el editor, **Ctrl + A**, **Suprimir**, **Ctrl + V**. Revisá que la última línea sea una llave `}`.
6. Guardá (**Ctrl + S**).

## 2. Preparar la pestaña de alumnos
1. Elegí la función **configurar** y tocá **Ejecutar**. Aceptá los permisos.
2. Aparece la pestaña **Alumnos** con las columnas: Nombre, Email, Planilla (link o ID), Clave, Link del dashboard.
3. Cargá una primera fila con **tu propia planilla** ("Juan Pablo Gomez"): tu nombre, tu email y el link de esa planilla (el que ves en la barra del navegador).
4. Volvé a Apps Script, elegí **generarClaves** y **Ejecutar**. Se completan solas la clave y el link.

## 3. (Opcional) Probar la lectura
En Apps Script, dentro de la función `probarLectura`, pegá entre las comillas de `LINK_O_ID` el link de tu planilla. Ejecutala y mirá **Ver > Registros de ejecución**: debe listar cuántas series leyó de cada ejercicio, qué semanas y cuántos días tildados.

## 4. Publicarlo
1. **Implementar > Nueva implementación**.
2. Tipo: **Aplicación web**.
3. **Ejecutar como: Yo**. **Quién tiene acceso: Cualquier persona**. (La clave de cada alumno es la que protege los datos.)
4. **Implementar** y copiá la **URL de la aplicación web**. Termina en `/exec`.
5. Pasame esa URL y yo la conecto con la página.

## Sumar un alumno nuevo (siempre igual)
1. Copiás tu planilla modelo para el alumno, como ya hacés.
2. En la pestaña **Alumnos**: nombre, email y link de su planilla.
3. Ejecutá **generarClaves**.
4. Copiá el link de la última columna y se lo mandás.

## Si un link se filtra o un alumno se va
Borrá la clave de esa fila (y ejecutá **generarClaves** si querés uno nuevo). El link viejo deja de funcionar al instante.

## Si cambiás el código más adelante
Pegá la versión nueva, guardá y hacé **Implementar > Administrar implementaciones > editar (lápiz) > Versión: Nueva versión**. La URL no cambia.
