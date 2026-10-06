# Calendario de asistencia: paso a paso

Esto se hace **una sola vez**, en la computadora, en tu planilla modelo. Después, cada alumno nuevo es una copia de esa planilla y ya viene con el calendario.

Qué crea: una pestaña **"Asistencia 2026"** con los 12 meses. Debajo de cada número de día hay un casillero. En el gimnasio, desde la tablet, tocás el casillero de hoy (el día de hoy se ve en naranja) y listo. Al costado de cada mes quedan el objetivo, los días realizados y una barra de progreso.

No borra ni cambia ninguna otra pestaña: solo agrega una nueva.

## 1. Probalo primero en una copia

1. Abrí la planilla "Juan Pablo Gomez" en la computadora.
2. Menú **Archivo > Hacer una copia**. Ponele "Prueba asistencia".
3. Trabajá en la copia hasta que veas que queda bien.

## 2. Pegar el código

1. En la copia, menú **Extensiones > Apps Script**.
2. Borrá lo que haya y pegá todo el contenido de `CrearAsistencia.gs`.
3. Arriba del código podés cambiar `ANIO` y `OBJETIVO_POR_DEFECTO` (días por mes). El objetivo después se cambia mes por mes directo en la planilla.
4. Guardá (ícono del disquete).

## 3. Ejecutar

1. Arriba, en el selector de funciones, elegí **crearAsistencia** y tocá **Ejecutar**.
2. La primera vez Google pide permisos ("Revisar permisos"). Elegí tu cuenta. Si aparece "Google no verificó esta aplicación", tocá **Configuración avanzada > Ir a ... (no seguro)**. Es normal: el código es tuyo. Solo pide permiso sobre esta planilla.
3. Cuando termina, aparece la pestaña **Asistencia 2026**.

## 4. Revisar

- Tildá algunos días y comprobá que los números y el objetivo suman bien.
- Para probar la lectura: ejecutá **probarLectura** y mirá **Ver > Registros de ejecución**. Debe listar las fechas que tildaste.

## 5. Dejarlo en la planilla modelo

Cuando te guste el resultado, repetí los pasos 2 y 3 en tu planilla modelo (la que se copia para cada alumno). Después podés borrar el código de Apps Script: el calendario queda.

Si querés rehacer la pestaña, borrala primero. El código no pisa una pestaña que ya existe.
