// CP Burger Breaker - Datos de niveles y jefes (declarativo, sin lógica).
// Agregar un nivel o un boss nuevo NUNCA debería requerir tocar engine.js,
// entities.js ni game.js: solo se agrega una entrada aquí.
//
// Grid de ladrillos: 10 columnas. Cada fila es un string de 10 caracteres.
// '.' = vacío. Dígito = tipo de ladrillo (ver BRICK_TYPES).

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  // 1 queso | 2 lechuga | 3 tomate | 4 tocineta (doble HP) | 5 pepinillo | 6 pan (doble HP)
  const BRICK_TYPES = {
    '1': { color: '#F4C542', hp: 1, points: 10, label: 'QUESO' },
    '2': { color: '#6FAE4C', hp: 1, points: 10, label: 'LECHUGA' },
    '3': { color: '#E05B4E', hp: 1, points: 10, label: 'TOMATE' },
    '4': { color: '#8B3A3A', hp: 2, points: 25, label: 'TOCINETA' },
    '5': { color: '#4F8F3D', hp: 1, points: 10, label: 'PEPINILLO' },
    '6': { color: '#D9A15B', hp: 2, points: 25, label: 'PAN' }
  };

  // Cápsulas de power-up: colores tomados 1:1 de la paleta real de marca.
  const POWERUP_TYPES = {
    SLOW: { color: '#B3DDDE', label: 'AZUL MAPLE', duration: 8000 },
    MULTI: { color: '#D9A15B', label: 'TRUFADA', duration: 0 },
    FIRE: { color: '#E8792E', label: 'HOT SWEET', duration: 7000 },
    WIDE: { color: '#8FC6C7', label: 'DOBLE', duration: 10000 },
    LIFE: { color: '#FFF8E9', label: 'SENCILLA', duration: 0 }
  };

  const POWERUP_DROP_CHANCE = 0.14;
  const POWERUP_WEIGHTS = [
    ['SLOW', 30], ['MULTI', 18], ['FIRE', 22], ['WIDE', 22], ['LIFE', 8]
  ];

  function rowsToGrid(rows) {
    return rows.map(row => row.split(''));
  }

  const LEVELS = [
    {
      id: 1,
      name: 'NIVEL 1',
      ballSpeed: 260,
      grid: rowsToGrid([
        '..111111..',
        '.11111111.',
        '11.11111.1',
        '1111111111',
        '11.11111.1',
        '111....111',
        '.11111111.'
      ])
    },
    {
      id: 2,
      name: 'NIVEL 2',
      ballSpeed: 280,
      grid: rowsToGrid([
        '2222222222',
        '3333333333',
        '5555555555',
        '4444444444',
        '2222222222',
        '3333333333'
      ])
    },
    {
      id: 'boss-1',
      name: 'BURGER DEALER',
      isBoss: true,
      ballSpeed: 280,
      boss: {
        key: 'dealer-rojo',
        name: 'BURGER DEALER',
        hp: 30,
        width: 180,
        height: 46,
        color: '#EE282F',
        moveSpeed: 90,
        fireInterval: 2200,
        projectileSpeed: 180,
        projectilesPerVolley: 1,
        phase2At: 0.5,
        phase2FireInterval: 1400,
        phase2MoveSpeedMult: 1.5
      }
    },
    {
      id: 3,
      name: 'NIVEL 3',
      ballSpeed: 300,
      // Forma el sello "C / P" con ladrillos.
      grid: rowsToGrid([
        '1111.1111.',
        '1....11.11',
        '1....11.11',
        '1....1111.',
        '1....11...',
        '1....11...',
        '1111.11...'
      ])
    },
    {
      id: 4,
      name: 'NIVEL 4',
      ballSpeed: 320,
      grid: rowsToGrid([
        '4646464646',
        '6464646464',
        '3333333333',
        '5252525252',
        '2525252525',
        '4646464646',
        '6464646464'
      ])
    },
    {
      id: 'boss-2',
      name: 'BURGER DEALER JEFE',
      isBoss: true,
      ballSpeed: 320,
      boss: {
        key: 'dealer-jefe',
        name: 'DEALER JEFE',
        hp: 55,
        width: 210,
        height: 50,
        color: '#A5171C',
        moveSpeed: 120,
        fireInterval: 1600,
        projectileSpeed: 210,
        projectilesPerVolley: 3,
        phase2At: 0.5,
        phase2FireInterval: 900,
        phase2MoveSpeedMult: 1.7
      }
    }
  ];

  window.CPGame.Levels = {
    GRID_COLS: 10,
    BRICK_TYPES,
    POWERUP_TYPES,
    POWERUP_DROP_CHANCE,
    POWERUP_WEIGHTS,
    LIST: LEVELS,
    get(index) {
      return LEVELS[index] || null;
    },
    total() {
      return LEVELS.length;
    }
  };
})();
