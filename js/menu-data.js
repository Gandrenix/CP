// Cuatro Paredes - Datos del Menú y Contenido (Menú real 2026)

const MENU_DATA = {
  burgers: [
    {
      id: "sencilla",
      name: "SENCILLA",
      price: 24900,
      description: "Pan, queso, salsa, carne (130 gr), cebolla, tomate, lechuga.",
      comboNote: "Combo con papas rústicas + Coca-Cola: $35.900",
      image: "assets/img/burger_sencilla_combo.jpg",
      tag: "FAVORITA"
    },
    {
      id: "doble",
      name: "DOBLE",
      price: 34900,
      description: "Pan, queso, salsa, doble carne (260 gr), cebolla, tomate, lechuga.",
      comboNote: "Combo con papas rústicas + Coca-Cola: $44.000",
      image: "assets/img/burger_sencilla_combo.jpg",
      tag: "260 GR"
    },
    {
      id: "hot-sweet",
      name: "HOT SWEET",
      price: 27000,
      description: "Pan, salsa, carne (125 gr), cebolla, tomate, lechuga, mermelada de jalapeños y tocineta.",
      comboNote: "Combo + papas y bebida: $37.500 · Doble: $43.900",
      image: "assets/img/burger_hot_sweet.jpg",
      tag: "PICANTE"
    },
    {
      id: "trufada",
      name: "TRUFADA",
      price: 29000,
      description: "Pan, queso, carne, chutney de tomates, crumble de chorizo artesanal, cebolla morada picada y salsa trufada.",
      comboNote: "Combo: $39.500 · Agranda a doble: $45.500",
      image: "assets/img/burger_trufada.jpg",
      tag: "EXPERIMENTO #1"
    },
    {
      id: "azul-maple",
      name: "AZUL MAPLE",
      price: 29000,
      description: "Pan de papa, carne (130 gr), dip de queso azul, cebolla caramelizada en miel de maple y queso mozzarella.",
      comboNote: "Combo: $39.500 · Agranda a doble: $45.500",
      image: "assets/img/burger_azul_maple.jpg",
      tag: "NUEVA"
    }
  ],
  papas: [
    {
      id: "papas-trufadas",
      name: "PAPAS TRUFADAS",
      price: 24900,
      description: "Papa rústica (300 gr), tocineta crocante, cebollín picado, queso parmesano, salsa trufada y mermelada de tomate.",
      comboNote: "Súmalas a cualquier combo por $5.500 más",
      image: "assets/img/papas_trufadas.jpg",
      tag: "DE LA CASA"
    },
    {
      id: "papas-cp",
      name: "PAPAS CP",
      price: 22000,
      description: "Papa rústica, tocineta crispy, salsa de pepinillos, doritos triturados y cebolla picada.",
      image: "assets/img/papas_trufadas.jpg",
      tag: "PARA COMPARTIR"
    },
    {
      id: "papas-rusticas",
      name: "PAPAS RÚSTICAS",
      price: 6500,
      description: "Nuestra papa de la casa, cortada rústica y frita al punto.",
      image: "assets/img/papas_trufadas.jpg",
      tag: "CLÁSICAS"
    }
  ],
  adiciones: [
    {
      id: "add-carne",
      name: "CARNE (130 GR)",
      price: 10000,
      description: "Una porción extra de carne para cualquier burger.",
      image: "assets/img/icon-carne.png",
      mediaFit: "contain"
    },
    {
      id: "add-pollo",
      name: "POLLO",
      price: 9000,
      description: "Pollo Jhonny Wings.",
      image: "assets/img/icon-alitas.png",
      mediaFit: "contain"
    },
    {
      id: "add-enchulado",
      name: "ENCHULADO",
      price: 5000,
      description: "Extra de nuestra salsa insignia.",
      image: "assets/img/icon-salsa.png",
      mediaFit: "contain"
    },
    {
      id: "add-tocineta",
      name: "TOCINETA",
      price: 4500,
      description: "Tocineta crocante extra.",
      image: "assets/img/icon-tocineta.png",
      mediaFit: "contain"
    },
    {
      id: "add-queso",
      name: "QUESO",
      price: 4500,
      description: "Queso extra derretido.",
      image: "assets/img/icon-queso.png",
      mediaFit: "contain"
    },
    {
      id: "add-pepinillos",
      name: "PEPINILLOS",
      price: 2000,
      description: "Porción extra de pepinillos.",
      image: "assets/img/icon-pepinillos.png",
      mediaFit: "contain"
    },
    {
      id: "galleta",
      name: "GALLETA CHIPS DE CHOCOLATE",
      price: 6000,
      description: "Galleta artesanal de chips de chocolate, recién horneada.",
      image: "assets/img/galleta_chocolate.jpg",
      tag: "POSTRE"
    }
  ],
  bebidas: [
    {
      id: "agua",
      name: "AGUA",
      price: 7000,
      description: "Botella de agua.",
      image: "assets/img/icon-agua.png",
      mediaFit: "contain"
    },
    {
      id: "coca-cola-250",
      name: "COCA-COLA (250 ML)",
      price: 5000,
      description: "Presentación personal en vidrio.",
      image: "assets/img/icon-cocacola250.png",
      mediaFit: "contain"
    },
    {
      id: "coca-cola-400",
      name: "COCA-COLA (400 ML)",
      price: 7000,
      description: "Presentación grande.",
      image: "assets/img/icon-cocacola400.png",
      mediaFit: "contain"
    },
    {
      id: "coca-cola-zero",
      name: "COCA-COLA ZERO (400 ML)",
      price: 7000,
      description: "Sin azúcar.",
      image: "assets/img/icon-cocacola400zero.png",
      mediaFit: "contain"
    },
    {
      id: "soda",
      name: "SODA",
      price: 7000,
      description: "Soda de la casa.",
      image: "assets/img/icon-soda.png",
      mediaFit: "contain"
    },
    {
      id: "soda-roja",
      name: "SODA ROJA",
      price: 7000,
      description: "Bebida refrescante sabor a cereza.",
      image: "assets/img/icon-sodaroja.png",
      mediaFit: "contain",
      tag: "CEREZA"
    },
    {
      id: "soda-azul",
      name: "SODA AZUL",
      price: 7000,
      description: "Bebida refrescante sabor cítrico con un toque de albahaca.",
      image: "assets/img/icon-sodaazul.png",
      mediaFit: "contain",
      tag: "CÍTRICO"
    }
  ],
  combos: [
    {
      id: "combo-para-dos",
      name: "COMBO PARA DOS",
      price: 67000,
      description: "2 burgers sencillas + 2 bebidas + papas CP.",
      image: "assets/img/burger_sencilla_combo.jpg",
      tag: "PARA 2"
    },
    {
      id: "combo-para-varios",
      name: "COMBO PARA VARIOS",
      price: 125000,
      description: "4 burgers sencillas + 4 sodas + 2 papas CP.",
      image: "assets/img/mesa_combo_varios.jpg",
      tag: "PARA EL PARCHE"
    }
  ]
};

const SEASON_ITEMS = [
  {
    id: "azul-maple",
    number: "01 / 02",
    name: "AZUL MAPLE",
    year: "2026",
    price: 29000,
    description: "Pan de papa, carne, dip de queso azul, cebolla caramelizada en miel de maple y queso mozzarella. Nuestro segundo experimento.",
    image: "assets/img/burger_azul_maple.jpg",
    note: "Agranda a doble por $45.500."
  },
  {
    id: "trufada",
    number: "02 / 02",
    name: "TRUFADA",
    year: "2026",
    price: 29000,
    description: "Pan, queso, carne, chutney de tomates, crumble de chorizo artesanal, cebolla morada picada y salsa trufada. Experimento #1.",
    image: "assets/img/burger_trufada.jpg",
    note: "Agranda a doble por $45.500."
  }
];

const EVENTS_DATA = [
  {
    id: "event-1",
    title: "BURGER DEALERS",
    date: "Próxima fecha por confirmar",
    time: "7:00 p.m.",
    location: "Bucaramanga",
    description: "El movimiento underground de Cuatro Paredes: pop-ups, música en vivo y recetas fuera de carta.",
    badge: "COMUNIDAD"
  },
  {
    id: "event-2",
    title: "JUEVES DE AJEDREZ",
    date: "Todos los jueves",
    time: "6:00 p.m.",
    location: "Bucaramanga",
    description: "Nuestro día especial de la semana: tableros disponibles, burgers dobles y buen ambiente.",
    badge: "TODAS LAS SEMANAS"
  }
];
