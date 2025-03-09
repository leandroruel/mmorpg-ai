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

// Configurações de IA dos monstros
export const MONSTER_AI_CONFIG = {
  enabled: true, // Habilitar/desabilitar IA dos monstros
  wanderRadius: 10, // Raio máximo de perambulação
  minWanderTime: 5000, // Tempo mínimo entre movimentos (ms)
  maxWanderTime: 15000, // Tempo máximo entre movimentos (ms)
  moveSpeed: 0.03, // Velocidade de movimento dos monstros
  wanderChance: 0.1, // Chance (0-1) de iniciar movimento quando parado
  aggroRadius: 8, // Raio em que o monstro detecta e persegue jogadores
  maxAggroDistance: 15, // Distância máxima para perseguir um jogador antes de desistir
  attackInterval: 1000, // Intervalo entre ataques do monstro (ms)
  checkPlayerInterval: 500, // Intervalo para verificar jogadores próximos (ms)
  aggroDuration: 10000, // Duração da agressividade após perder o alvo (ms)
  respawnTime: 15000, // Tempo para o monstro reaparecer após morrer (ms) - Aumentado
  respawnRadius: 15, // Raio em torno da posição original onde o monstro pode respawnar
  monsterTypes: {
    // Tipos de monstros e suas configurações específicas
    poring: {
      isAggressive: false, // Monstro passivo
      aggroRadius: 0, // Só ataca se atacado
      moveSpeed: 0.02,
      attackRange: 1.0,
      attackDamage: 3,
      attackInterval: 1500,
      color: 0xff9999 // Rosa claro
    },
    zombie: {
      isAggressive: true, // Monstro agressivo
      aggroRadius: 6, // Raio de detecção de jogadores
      moveSpeed: 0.025,
      attackRange: 1.2,
      attackDamage: 10,
      attackInterval: 2000,
      color: 0x88aa88 // Verde acinzentado
    },
    ghost: {
      isAggressive: false,
      aggroRadius: 0,
      moveSpeed: 0.035,
      attackRange: 2.0,
      attackDamage: 15,
      attackInterval: 2500,
      color: 0xaaaaff // Azul claro
    },
    orc: {
      isAggressive: true,
      aggroRadius: 10,
      moveSpeed: 0.02,
      attackRange: 1.5,
      attackDamage: 20,
      attackInterval: 1800,
      color: 0x996633 // Marrom
    }
  }
};

// Efeitos visuais
export const VISUAL_EFFECTS = {
  attackColor: 0xff0000,
  moveMarkerColor: 0xffff00,
  attackMarkerColor: 0xff0000
};

// Configuração de Debug
export const DEBUG_CONFIG = {
  enabled: true,
  logCombat: true,    // Logs detalhados de combate
  logMovement: false, // Logs de movimento
  logNetwork: true,   // Logs de rede
  showHitboxes: false, // Mostrar hitboxes
  immortalPlayer: false, // Jogador imortal (não recebe dano)
  oneShotKill: false,  // Matar monstros com um golpe
  showStats: true     // Mostrar estatísticas de performance
};

// Assets a carregar
export const ASSETS_CONFIG = {
  models: [
    { name: 'player', path: './models/character.gltf' },
    { name: 'monster', path: './models/monster.gltf' }
  ]
}; 