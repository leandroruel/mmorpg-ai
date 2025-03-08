/**
 * Configurações globais do jogo
 */

// Definição das classes de personagens
export const CHARACTER_CLASSES = {
  knight: {
    name: 'Cavaleiro',
    attackRange: 1.5,
    attackSpeed: 1.0,
    moveSpeed: 0.05,
    color: 0x8B4513 // Marrom para cavaleiros
  },
  mage: {
    name: 'Mago',
    attackRange: 5.0,
    attackSpeed: 0.8,
    moveSpeed: 0.04,
    color: 0x0000FF // Azul para magos
  },
  archer: {
    name: 'Arqueiro',
    attackRange: 4.0,
    attackSpeed: 1.2,
    moveSpeed: 0.045,
    color: 0x006400 // Verde escuro para arqueiros
  },
  warrior: {
    name: 'Guerreiro',
    attackRange: 1.8,
    attackSpeed: 0.9,
    moveSpeed: 0.055,
    color: 0xA52A2A // Vermelho escuro para guerreiros
  }
};

// Configurações de conexão
export const CONNECTION_CONFIG = {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  timeout: 10000,
  forceNew: true
};

// Configurações de render e visuais
export const RENDER_CONFIG = {
  frustumSize: 20,
  backgroundColor: 0x87ceeb,
  groundColor: 0x33aa33
};

// Configurações de combate
export const COMBAT_CONFIG = {
  defaultAttackRange: 1.5,
  defaultAttackCooldown: 1000,
  attackEffectDuration: 200
};

// Configurações de movimento
export const MOVEMENT_CONFIG = {
  defaultMoveSpeed: 0.05,
  destinationThreshold: 0.1
};

// Efeitos visuais
export const VISUAL_EFFECTS = {
  attackColor: 0xff0000,
  moveMarkerColor: 0xffff00,
  attackMarkerColor: 0xff0000
};

// Assets a carregar
export const ASSETS_CONFIG = {
  models: [
    { name: 'player', path: './models/character.gltf' },
    { name: 'monster', path: './models/monster.gltf' }
  ]
}; 