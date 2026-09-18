# 🔥 CUATRO PAREDES | Smiley Face Burgers & Stuff

Sitio web oficial de **Cuatro Paredes** (Bucaramanga & San Gil, Colombia), construido a partir del menú real, los precios reales y el material de identidad de marca del restaurante (`Material restaurante/`).

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Gandrenix/CP)

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
- **Carrito de Compras & WhatsApp**: Drawer lateral con cálculo automático de subtotales, costo de envío y generación de mensaje listo para enviar a WhatsApp.

> **Nota:** el sitio ya no incluye CP Club, Regala una Burger, ni las colaboraciones con Carhartt / Cerveza Norte / Tostao — no estaban documentadas en el material real de marca. Si el restaurante confirma alguna de estas iniciativas, se pueden volver a incorporar con datos reales.

---

## 🛠️ Tecnologías

- **HTML5 Semántico**: Estructura accesible y optimizada para SEO.
- **CSS3 Puro (Vanilla)**: Variables CSS, Flexbox, CSS Grid y micro-animaciones sin dependencias pesadas.
- **JavaScript (ES6+)**: Lógica modular para el carrito, carruseles, lightbox, tabs, mapa y minijuego arcade.
- **Google Fonts**: `Bebas Neue` (titulares monumentales), `Plus Jakarta Sans` (cuerpo), `Space Mono` (precios y etiquetas técnicas, fiel al menú impreso real) y `Caveat` (acentos caligráficos).
- **Leaflet + OpenStreetMap**: Mapa interactivo autohospedado en el modal "Cómo llegar" (carga solo bajo demanda, sin costo de API).
- **Netlify Ready**: Configuración `netlify.toml` lista para despliegue instantáneo con cabeceras de seguridad y caché de activos estáticos.

---

## 🚀 Despliegue en Netlify

1. Haz clic en el botón **Deploy to Netlify** arriba o conecta este repositorio directamente desde el panel de [Netlify](https://app.netlify.com).
2. Configuración de Build:
   - **Build command**: *(Dejar vacío)*
   - **Publish directory**: `.`
3. ¡Listo! El sitio estará en vivo en segundos con SSL automático.

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
