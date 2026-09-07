# 🔥 CUATRO PAREDES | Burgers. Sodas. Antojos.

Sitio web oficial de **Cuatro Paredes** (Bucaramanga & San Gil, Colombia), construido con base en la identidad visual de marca y los 12 paneles de experiencia digital.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Gandrenix/CP)

---

## 🍔 Características del Proyecto

- **Header & Hero**: Barra de navegación sticky con acceso directo al menú, temporadas, sedes y botón de pedido inmediato.
- **El Antojo**: Carrusel rápido de las burgers más pedidas (*Clásica*, *Cheese*, *Doble*, *Especial*).
- **Menú Completo**: Navegación dinámica por categorías (*Burgers*, *Sodas*, *Cookies*, *Salsas*) con precios en COP e integración al carrito.
- **Temporada & Archivo**: Showcase de la burger del momento (*The Meltdown*) con carrusel interactivo `01 / 04` y archivo histórico por años.
- **Pedir**: Selector interactivo de ciudad (*Bucaramanga* / *San Gil*) y modalidad (*Domicilio* / *Recoger*) con enlaces directos a WhatsApp y Rappi.
- **Las Casas**: Fichas completas de las sedes con horarios, direcciones, botón con mapa interactivo y el banner *"VEN POR LAS BURGERS. QUÉDATE PORQUE ESTÁS PARCHADO. :)"*.
- **CP World**: Universo cultural streetwear con 6 bloques interactivos (*Eventos*, *Burger Dealers*, *Colabs*, *Merch*, *Objetos* y *Juegos* con minijuego retro en canvas).
- **Colaboraciones**: Lookbook interactivo de la colección streetwear *CP × Carhartt 2026* y cápsulas pasadas.
- **CP Club**: Programa de fidelización con tarjeta 3D interactiva, beneficios exclusivos y formulario de suscripción.
- **Regala una Burger**: Personalización y compra de tarjetas de regalo virtuales.
- **Eventos**: Calendario de actividades, torneos de ajedrez y sesiones de música en vivo con confirmación RSVP.
- **Archivo CP**: Galería fotográfica histórica filtrable por años (2026, 2025, 2024, 2023) con lightbox a pantalla completa.
- **Footer & ¿Hambre?**: Acceso rápido a atención por WhatsApp, redes sociales, PQRS y políticas de privacidad.
- **Carrito de Compras & WhatsApp**: Drawer lateral con cálculo automático de subtotales, costo de envío y generación de mensaje listo para enviar a WhatsApp.

---

## 🛠️ Tecnologías

- **HTML5 Semántico**: Estructura accesible y optimizada para SEO.
- **CSS3 Puro (Vanilla)**: Variables CSS, Flexbox, CSS Grid y micro-animaciones sin dependencias pesadas.
- **JavaScript (ES6+)**: Lógica modular para el carrito, carruseles, lightbox, tabs y minijuego arcade.
- **Google Fonts**: `Bebas Neue` (titulares monumentales), `Plus Jakarta Sans` (cuerpo) y `Caveat` (acentos caligráficos).
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
