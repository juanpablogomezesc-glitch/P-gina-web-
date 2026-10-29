# Servidor en la notebook Bangho: guía paso a paso

Convertimos la notebook Bangho (4 GB de RAM) en un servidor, de a una etapa por vez.
Cada etapa termina con algo que funciona. Recién ahí pasamos a la siguiente.

| Etapa | Qué hacemos | Estado |
|---|---|---|
| 1 | Instalar Ubuntu Server en la Bangho | ⬜ |
| 2 | Manejarla desde la compu Windows y el iPhone (SSH) | ⬜ |
| 3 | Prender el primer servidor "Hola" con Node | ⬜ |
| 4 | Verlo desde el iPhone con el wifi de casa | ⬜ |
| 5 | Publicarlo en internet con un dominio (Cloudflare Tunnel) | más adelante |
| 6 | Primera mini app con base de datos | más adelante |

Si algo aparece distinto a lo que dice acá, sacale una foto a la pantalla y consultalo antes de seguir.

---

## Etapa 1: instalar Ubuntu Server

⚠️ **Esto borra todo lo que tiene la Bangho, incluido Windows.** Antes, copiá lo que quieras guardar.

**Qué necesitás:** la Bangho con su cargador, un pendrive de 8 GB o más (se borra) y la compu Windows.
Si podés, conectá la Bangho al router con un cable de red.

### 1.1 Preparar el pendrive (en la compu Windows)

1. Descargá **Ubuntu Server**, versión **LTS**, desde <https://ubuntu.com/download/server>. Es un archivo `.iso` de unos 3 GB.
2. Descargá **Rufus** desde <https://rufus.ie> (la versión "portable" no necesita instalarse).
3. Abrí Rufus, elegí el pendrive en *Dispositivo*, tocá *Seleccionar* y elegí el `.iso`. Dejá todo lo demás como está y tocá **Empezar**.
   Si pregunta por el modo de escritura, elegí la opción recomendada (ISO).

### 1.2 Arrancar la Bangho desde el pendrive

1. Con el pendrive puesto y la Bangho apagada, prendela y tocá repetidamente **F7**.
   Si no aparece un menú para elegir el pendrive, probá con **F12**, **F11** o **Esc**.
2. Elegí el pendrive (suele aparecer con la marca del pendrive o como "UEFI: ...").
3. Si con ninguna tecla aparece el menú: entrá a la configuración (BIOS) con **F2** o **Supr** al prender,
   buscá la sección *Boot*, poné el pendrive primero en la lista, guardá con **F10** y reiniciá.

### 1.3 El instalador

Se maneja con las flechas, **Enter** para elegir y **Tab** para pasar de un campo a otro.

| Pantalla | Qué elegir |
|---|---|
| Idioma | English (los mensajes en inglés son los que más ayuda tienen en internet) |
| Keyboard | Layout: **Spanish (Latin American)** |
| Tipo de instalación | Ubuntu Server (la opción normal, no la "minimized") |
| Network | Si está el cable, ya aparece conectado. Si es por wifi, elegí la red y poné la clave |
| Proxy / Mirror | Dejar como está, *Done* |
| Storage | **Use an entire disk**, *Done* y confirmar (*Continue*) |
| Profile | Your name: `Juan Pablo` · Server name: `jp-server` · Username: `juanpablo` · contraseña: **anotala** |
| Ubuntu Pro | Skip for now |
| SSH | ✅ **Marcar "Install OpenSSH server"** (con la barra espaciadora) |
| Featured snaps | No marcar nada, *Done* |

Cuando termine dice *Reboot Now*. Sacá el pendrive cuando lo pida y dale Enter.

### 1.4 Primer ingreso

Aparece una pantalla negra con `jp-server login:`. Escribí `juanpablo`, Enter, y la contraseña.
Mientras la escribís no se ve nada en la pantalla: es normal. Si ves algo como `juanpablo@jp-server:~$`, **ya tenés un servidor**.

Ahora, tres ajustes. Escribí cada línea y dale Enter. `sudo` significa "hacelo como administrador" y pide tu contraseña.

```bash
# 1. Actualizar todo el sistema (tarda unos minutos la primera vez)
sudo apt update && sudo apt upgrade -y

# 2. Que no se apague ni se suspenda al cerrar la tapa
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind

# 3. Ver la dirección (IP) de la notebook en tu red. Anotala: la vas a usar todo el tiempo
hostname -I
```

La IP es algo como `192.168.0.25` (el primer número que aparece).

✅ **Etapa 1 lista** cuando podés entrar con tu usuario, cerrar la tapa sin que se apague y tenés la IP anotada.

> **La batería:** si está hinchada o la tapa no cierra bien, sacala y usala solo con el cargador.
> Una batería vieja enchufada todo el día es el único riesgo real de usar una notebook como servidor.

---

## Etapa 2: manejarla desde otra compu (SSH)

SSH es un "control remoto por comandos". Desde ahora la Bangho puede quedar cerrada en un rincón
y la manejás desde la compu Windows o desde el iPhone.

**Desde la compu Windows:** abrí **PowerShell** (buscalo en el menú Inicio) y escribí, con tu IP:

```bash
ssh juanpablo@192.168.0.25
```

La primera vez pregunta *Are you sure you want to continue connecting?*: escribí `yes`. Después pide la contraseña.
Cuando ves `juanpablo@jp-server:~$`, todo lo que escribís se ejecuta en la Bangho. Para salir: `exit`.

**Desde el iPhone:** instalá la app **Termius** (gratis). *New Host*: en *Hostname* va la IP,
en *Username* `juanpablo` y en *Password* tu contraseña. Tocás el host y entrás.

✅ **Etapa 2 lista** cuando entrás desde la compu Windows y desde el iPhone con la Bangho cerrada.

---

## Etapa 3: el primer servidor "Hola"

Todo esto se escribe conectado por SSH a la Bangho.

```bash
# Instalar Node (el programa que ejecuta nuestro código) y git (para bajar el código desde GitHub)
sudo apt install -y nodejs git

# Comprobar que quedó instalado: tiene que mostrar un número de versión
node --version

# Bajar este repositorio a la Bangho
git clone -b claude/training-app-server-v5xpbw https://github.com/juanpablogomezesc-glitch/P-gina-web-.git sitio

# Entrar a la carpeta del servidor y prenderlo
cd sitio/servidor/hola
node servidor.js
```

Tiene que aparecer `Servidor prendido...`. El código está en [`hola/servidor.js`](hola/servidor.js),
explicado línea por línea. Vale la pena leerlo.

Para frenarlo: **Ctrl + C**.

✅ **Etapa 3 lista** cuando ves el mensaje `Servidor prendido`.

---

## Etapa 4: verlo desde el iPhone

Con el servidor prendido (etapa 3), en el iPhone conectado al **wifi de tu casa**, abrí Safari y entrá a:

```
http://192.168.0.25:3000
```

(con tu IP). Tiene que aparecer **"¡Hola! Este es mi servidor"** en naranja.
Recargá la página: el número de visitas sube, y en la pantalla de SSH aparece una línea por cada visita.

- `192.168.0.25` es la dirección de la notebook dentro de tu casa.
- `:3000` es el puerto: la "puerta" por la que escucha nuestro programa.
- Con los datos móviles del iPhone **no** funciona todavía: por ahora solo se ve dentro de tu casa. Eso lo resolvemos en la etapa 5.

✅ **Etapa 4 lista** cuando ves la página en el iPhone y el contador sube.

---

## Si algo falla

| Qué pasa | Qué probar |
|---|---|
| La Bangho arranca Windows y no el pendrive | Volver a 1.2 y probar otra tecla, o cambiar el orden en la BIOS |
| `ssh: connect to host ... timed out` | ¿La Bangho está prendida? ¿La IP es la correcta? (`hostname -I` en la Bangho) |
| `git clone` pide usuario y contraseña | El repositorio es privado: consultalo antes de seguir |
| La página no carga en el iPhone | ¿El servidor sigue prendido en SSH? ¿El iPhone está en el wifi de casa y no con datos? |
| La IP cambió de un día para otro | Es normal en algunos routers. Más adelante la fijamos |
