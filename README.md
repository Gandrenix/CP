# 🔥 CUATRO PAREDES | Smiley Face Burgers & Stuff

Sitio web oficial de **Cuatro Paredes** (Bucaramanga & San Gil, Colombia), construido a partir del menú real, los precios reales y el material de identidad de marca del restaurante (`Material restaurante/`).

---

## 🍔 Características del Proyecto

- **Header & Hero**: Barra de navegación sticky con acceso directo al menú, temporadas, sedes y botón de pedido inmediato.
- **El Antojo**: Las 4 burgers insignia (*Sencilla*, *Hot Sweet*, *Trufada*, *Azul Maple*) con fotos reales del menú del restaurante.
- **Menú Completo**: Navegación dinámica por categorías (*Burgers*, *Papas*, *Combos*, *Adiciones*, *Bebidas*) con precios reales en COP e integración al carrito.
- **Temporada**: Showcase de los dos experimentos de temporada (*Azul Maple*, *Trufada*) con carrusel interactivo `01 / 02`.
- **Pedir**: Selector interactivo de ciudad (*Bucaramanga* / *San Gil*) y modalidad (*Domicilio* / *Recoger*) con enlaces directos a WhatsApp y Rappi.
- **Las Casas**: Fichas completas de las sedes con horarios, direcciones, botón con mapa interactivo (Leaflet + OpenStreetMap, autohospedado) y el banner *"VEN POR LAS BURGERS. QUÉDATE PORQUE ESTÁS PARCHADO. :)"*.
- **CP World**: 6 bloques interactivos (*Eventos*, *Burger Dealers*, *CP × Jim Pluk*, *Merch*, *Objetos* y *Juegos* con minijuego retro en canvas).
- **Eventos**: *Burger Dealers* y *Jueves de Ajedrez*, con confirmación RSVP.
- **Galería**: Fotografías reales del producto con lightbox a pantalla completa (lista para sumar más fotos del restaurante cuando estén disponibles).
- **Footer & ¿Hambre?**: Acceso rápido a atención por WhatsApp, redes sociales, PQRS y políticas de privacidad.
- **Carrito de Compras & Chat**: Drawer lateral con cálculo automático de subtotales y costo de envío. El pedido se envía por el chat de LiveConnect (ver abajo) y, si el chat no responde, se ofrece enviarlo por WhatsApp con el mismo texto.
- **Chat (LiveConnect)**: Botón flotante pixel-art con la marca y módulo `js/chat/` que lleva consultas y pedidos a la bandeja de LiveConnect. Los visitantes son anónimos; el cliente se reconoce por su **teléfono** (se normaliza a `57XXXXXXXXXX`) y el navegador recuerda sus datos para el siguiente pedido.

> **Nota:** el sitio ya no incluye CP Club, Regala una Burger, ni las colaboraciones con Carhartt / Cerveza Norte / Tostao — no estaban documentadas en el material real de marca. Si el restaurante confirma alguna de estas iniciativas, se pueden volver a incorporar con datos reales.

---

## 🛠️ Tecnologías

- **HTML5 Semántico**: Estructura accesible y optimizada para SEO.
- **CSS3 Puro (Vanilla)**: Variables CSS, Flexbox, CSS Grid y micro-animaciones sin dependencias pesadas.
- **JavaScript (ES6+)**: Lógica modular para el carrito, carruseles, lightbox, tabs, mapa y minijuego arcade.
- **Google Fonts**: `Bebas Neue` (titulares monumentales), `Plus Jakarta Sans` (cuerpo), `Space Mono` (precios y etiquetas técnicas, fiel al menú impreso real) y `Caveat` (acentos caligráficos).
- **Leaflet + OpenStreetMap**: Mapa interactivo autohospedado en el modal "Cómo llegar" (carga solo bajo demanda, sin costo de API).
- **Cloudflare Workers (assets estáticos)**: `wrangler.jsonc`, `.assetsignore` y `_headers` listos para desplegar con cabeceras de seguridad y caché que revalida.

---

## 🚀 Despliegue en Cloudflare

Producción: **https://cuatroparedes.wienerhound.com**

1. Conecta este repositorio en Cloudflare (Workers Builds) con el comando de despliegue `npx wrangler deploy`. Sin comando de build.
2. La configuración vive en el repo, no hace falta tocar nada más:
   - `wrangler.jsonc`: nombre del Worker (`cp`) y carpeta de assets (`.`).
   - `.assetsignore`: **qué NO se publica**. El repositorio contiene material interno (`Material restaurante/`, `Portafolio/`, fuentes originales…) que no debe salir en el sitio; solo se publican `index.html`, `css/`, `js/` y `assets/`. Si agregas carpetas nuevas con material interno, añádelas ahí.
   - `_headers`: cabeceras de seguridad y de caché.
3. Cloudflare limita cada archivo publicado a 25 MiB.

### Chat de LiveConnect en un dominio nuevo

El widget solo carga en los dominios autorizados del canal. Al cambiar de dominio, agrégalo en LiveConnect → Canales → *Chat Cuatro Paredes* → **Seguridad → Dominios de confianza**. Sin eso el chat muestra "Dominio no autorizado" y el carrito ofrece WhatsApp como alternativa.

### Netlify (ya no es el despliegue principal)

`netlify.toml` se conserva por compatibilidad, pero Netlify publica **toda** la carpeta (`publish = "."`), incluido el material interno. No se recomienda desplegar este repositorio allí sin primero separar el sitio en su propia carpeta.

---

## 💻 Ejecución Local

Para probar localmente:

```bash
# Con Python
python -m http.server 3000

# O con Node.js
npx serve .
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
