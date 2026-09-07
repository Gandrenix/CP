// Cuatro Paredes - Datos del Menú y Contenido

const MENU_DATA = {
  burgers: [
    {
      id: "clasica",
      name: "CLÁSICA",
      price: 22000,
      description: "Pan artesanal, carne Angus, queso, lechuga, tomate, cebolla, salsa de la casa.",
      image: "assets/img/burger_clasica.jpg",
      tag: "FAVORITA"
    },
    {
      id: "cheese",
      name: "CHEESE",
      price: 24000,
      description: "Pan artesanal, carne Angus, doble queso, lechuga, tomate, cebolla, salsa de la casa.",
      image: "assets/img/antojo_cheese.png",
      tag: "EXTRA QUESO"
    },
    {
      id: "doble",
      name: "DOBLE",
      price: 28000,
      description: "Doble carne Angus, doble queso, lechuga, tomate, cebolla, salsa de la casa.",
      image: "assets/img/hero_burger.jpg",
      tag: "DOBLE CARNE"
    },
    {
      id: "especial",
      name: "ESPECIAL",
      price: 26000,
      description: "Pan artesanal, carne Angus, queso, tocineta, cebolla caramelizada, salsa de la casa.",
      image: "assets/img/antojo_especial.png",
      tag: "TOCINETA CRUJIENTE"
    }
  ],
  sodas: [
    {
      id: "soda-maracuya",
      name: "SODA MARACUYÁ & ALBAHACA",
      price: 8000,
      description: "Soda artesanal infusionada con pulpa fresca de maracuyá, sirope ligero de albahaca y hielo.",
      image: "assets/img/event_burger.jpg",
      tag: "ARTESANAL"
    },
    {
      id: "soda-frutos-rojos",
      name: "SODA FRUTOS ROJOS",
      price: 8000,
      description: "Mora silvestre, fresa y frambuesa con soda efervescente y toques cítricos de limón mandarino.",
      image: "assets/img/pedir_fries.jpg",
      tag: "REFRESCANTE"
    },
    {
      id: "limonada-coco",
      name: "LIMONADA DE COCO",
      price: 9000,
      description: "Crema de coco de la casa batida al momento con zumo de limón fresco y escarcha.",
      image: "assets/img/event_burger.jpg",
      tag: "CLÁSICO"
    },
    {
      id: "coca-cola",
      name: "COCA-COLA ORIGINAL 350ML",
      price: 6000,
      description: "Lata helada tradicional para acompañar la mejor burger.",
      image: "assets/img/pedir_fries.jpg",
      tag: "ORIGINAL"
    }
  ],
  cookies: [
    {
      id: "cookie-choco",
      name: "CHOCO CHIP ARTESANAL",
      price: 7000,
      description: "Galleta horneada a diario con trozos de chocolate oscuro 70% Santander y centro suave.",
      image: "assets/img/antojo_doble.png",
      tag: "RECIÉN HORNEADA"
    },
    {
      id: "cookie-redvelvet",
      name: "RED VELVET COOKIE",
      price: 8000,
      description: "Masa aterciopelada roja rellena de crema de queso blanco derretido en el centro.",
      image: "assets/img/antojo_especial.png",
      tag: "FAVORITO DULCE"
    },
    {
      id: "cookie-cream",
      name: "COOKIES & CREAM CRUNCH",
      price: 8000,
      description: "Galleta con trozos crocantes de galleta negra y chocolate blanco tostado.",
      image: "assets/img/antojo_clasica.png",
      tag: "CRUJIENTE"
    }
  ],
  salsas: [
    {
      id: "salsa-cp",
      name: "SALSA CUATRO PAREDES (2 OZ)",
      price: 4000,
      description: "Nuestra salsa secreta ahumada con especias de la casa, ligeramente dulce y cremosa.",
      image: "assets/img/meltdown_burger.jpg",
      tag: "DE LA CASA"
    },
    {
      id: "salsa-jalapeno",
      name: "MAYO JALAPEÑO",
      price: 4000,
      description: "Mayonesa emulsionada con jalapeños asados al carbón y un toque de cilantro silvestre.",
      image: "assets/img/hero_burger.jpg",
      tag: "PICANTE MEDIO"
    },
    {
      id: "salsa-bbq",
      name: "BBQ BOURBON & PANELA",
      price: 4000,
      description: "Reducción artesanal de panela santandereana, bourbon ahumado y tomate asado.",
      image: "assets/img/burger_clasica.jpg",
      tag: "DULCE AHUMADA"
    }
  ]
};

const SEASON_ITEMS = [
  {
    id: "meltdown",
    number: "01 / 04",
    name: "THE MELTDOWN",
    year: "2026",
    price: 27000,
    description: "Carne Angus, queso cheddar, salsa de jalapeño, cebolla caramelizada, pan artesanal.",
    image: "assets/img/meltdown_burger.jpg",
    note: "Disponible hasta agotar existencias."
  },
  {
    id: "la-santa",
    number: "02 / 04",
    name: "LA SANTA",
    year: "2025",
    price: 28500,
    description: "Carne Angus madurada 21 días, queso brie fundido, mermelada de tocineta ahumada y rúgula fresca.",
    image: "assets/img/hero_burger.jpg",
    note: "Edición especial limitada."
  },
  {
    id: "tropical",
    number: "03 / 04",
    name: "TROPICAL",
    year: "2024",
    price: 26000,
    description: "Carne Angus, piña caramelizada a la brasa con canela, queso costeño asado y salsa tartara de la casa.",
    image: "assets/img/event_burger.jpg",
    note: "Inspirada en el Caribe santandereano."
  },
  {
    id: "la-noche",
    number: "04 / 04",
    name: "LA NOCHE",
    year: "2023",
    price: 29000,
    description: "Pan brioche negro artesanal, doble carne Angus, queso pepper jack fundido y alioli de ajo negro.",
    image: "assets/img/burger_clasica.jpg",
    note: "La favorita del archivo histórico."
  }
];

const ARCHIVE_PHOTOS = {
  "2026": [
    { title: "The Meltdown Launch", image: "assets/img/meltdown_burger.jpg", tag: "TEMPORADA" },
    { title: "CP Cap Black Edition", image: "assets/img/world_merch.png", tag: "MERCH" },
    { title: "Streetwear Drop Artwork", image: "assets/img/colab_carhartt.jpg", tag: "COLAB" },
    { title: "Double Smash Station", image: "assets/img/hero_burger.jpg", tag: "COCINA" },
    { title: "Late Night at El Prado", image: "assets/img/store_bucaramanga.jpg", tag: "BUCARAMANGA" },
    { title: "San Gil Centro Spot", image: "assets/img/store_sangil.jpg", tag: "SAN GIL" }
  ],
  "2025": [
    { title: "Colab Jim Pluk Trucker", image: "assets/img/colab_pluk.png", tag: "ARTE" },
    { title: "Cerveza Norte × CP", image: "assets/img/colab_norte.png", tag: "BEBIDA" },
    { title: "Burger Dealers Session 03", image: "assets/img/world_dealers.png", tag: "EVENTO" },
    { title: "La Santa Special Edition", image: "assets/img/burger_clasica.jpg", tag: "BURGER" },
    { title: "Arcade Retro Tournament", image: "assets/img/world_juegos.png", tag: "COMUNIDAD" },
    { title: "Patio Night Vibes", image: "assets/img/footer_bg.jpg", tag: "NOCHES" }
  ],
  "2024": [
    { title: "Tostao × CP Café & Bites", image: "assets/img/colab_tostao.png", tag: "COLAB" },
    { title: "Tropical Burger Debut", image: "assets/img/event_burger.jpg", tag: "TEMPORADA" },
    { title: "Sticker Pack Vol. 1", image: "assets/img/world_objetos.png", tag: "OBJETOS" },
    { title: "Opening San Gil Plaza", image: "assets/img/store_sangil.jpg", tag: "EXPANSIÓN" },
    { title: "CP Crew Bucaramanga", image: "assets/img/world_eventos.png", tag: "EQUIPO" },
    { title: "First Batch Fries", image: "assets/img/pedir_fries.jpg", tag: "CLÁSICOS" }
  ],
  "2023": [
    { title: "Day One Smash Burger", image: "assets/img/hero_burger.jpg", tag: "ORIGEN" },
    { title: "La Noche Black Bun", image: "assets/img/burger_clasica.jpg", tag: "INNOVACIÓN" },
    { title: "First Red Membership Card", image: "assets/img/club_card_hand.jpg", tag: "CP CLUB" },
    { title: "The Corner Awning", image: "assets/img/footer_bg.jpg", tag: "SEDE 01" },
    { title: "Burger Dealers Kickoff", image: "assets/img/world_dealers.png", tag: "INICIOS" },
    { title: "Late Night Parchado", image: "assets/img/store_bucaramanga.jpg", tag: "CULTURA" }
  ]
};

const EVENTS_DATA = [
  {
    id: "event-1",
    title: "BURGER DEALERS",
    date: "Sáb, 14 Jun 2026",
    time: "7:00 p.m.",
    location: "Bucaramanga • Cra 35 #37-46, El Prado",
    description: "Noche de beats en vivo, vinilos, burgers fuera de carta preparadas en vivo y cerveza artesanal fría.",
    badge: "SOLD OUT PRONTO"
  },
  {
    id: "event-2",
    title: "JUEVES DE AJEDREZ",
    date: "Jue, 19 Jun 2026",
    time: "6:00 p.m.",
    location: "Bucaramanga • Terraza El Prado",
    description: "Torneo abierto de ajedrez rápido. Tableros disponibles, burgers dobles y premios especiales para los finalistas.",
    badge: "INSCRIPCIÓN GRATIS"
  },
  {
    id: "event-3",
    title: "LANZAMIENTO TEMPORADA",
    date: "Vie, 27 Jun 2026",
    time: "7:00 p.m.",
    location: "San Gil • Cra 10 #10-62, Centro",
    description: "Presentación oficial de la nueva receta de temporada junto al equipo fundador de Cuatro Paredes con degustaciones y música.",
    badge: "ACCESO CP CLUB"
  }
];
