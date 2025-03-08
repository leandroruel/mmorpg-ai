/**
 * Configurações globais do sistema de combate
 */

// Configurações gerais
export const COMBAT_CONFIG = {
  // Cooldowns e intervalos (ms)
  DEFAULT_ATTACK_COOLDOWN: 1000,
  DEFAULT_SKILL_COOLDOWN: 3000,
  EFFECT_DURATION: 200,
  AUTO_ATTACK_INTERVAL: 1500,
  
  // Multiplicadores de dano
  CRITICAL_CHANCE: 0.1,          // 10% de chance de acerto crítico
  CRITICAL_MULTIPLIER: 1.5,      // 50% de dano adicional em acertos críticos
  BACKSTAB_MULTIPLIER: 1.2,      // 20% de dano adicional em ataques pelas costas
  
  // Distâncias e alcances
  MELEE_RANGE: 1.5,              // Alcance de ataques corpo a corpo
  RANGE_ATTACK_MODIFIER: 0.8,    // Modificador de dano para ataques à distância
  ATTACK_RANGE_TOLERANCE: 1.2,   // Tolerância para checagem de alcance (20%)
  
  // Feedback visual
  DAMAGE_TEXT_DURATION: 1000,    // Duração do texto de dano (ms)
  DAMAGE_TEXT_RISE: 2,           // Altura que o texto de dano sobe
  DAMAGE_FLASH_DURATION: 200,    // Duração do flash de dano (ms)
  
  // Configurações de atacante/alvo
  TARGET_SWITCH_COOLDOWN: 500,   // Tempo mínimo entre troca de alvos (ms)
  AGGRO_DURATION: 10000,         // Duração da agressividade (ms)
  MAX_AGGRO_DISTANCE: 15,        // Distância máxima para manter agressividade
  
  // Atributos base para balanceamento
  BASE_HP: 100,
  BASE_MP: 50,
  BASE_ATTACK: 10,
  BASE_DEFENSE: 5,
  HP_PER_LEVEL: 10,
  MP_PER_LEVEL: 5,
  ATTACK_PER_LEVEL: 2,
  DEFENSE_PER_LEVEL: 1
};

// Tipos de dano
export const DAMAGE_TYPES = {
  PHYSICAL: 'physical',
  MAGICAL: 'magical',
  TRUE: 'true',        // Dano verdadeiro (ignora defesa)
  FIRE: 'fire',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  POISON: 'poison'
};

// Tipos de habilidades
export const SKILL_TYPES = {
  ATTACK: 'attack',
  HEAL: 'heal',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  AREA: 'area',
  PROJECTILE: 'projectile'
};

// Cores para feedback visual
export const COMBAT_COLORS = {
  PHYSICAL_DAMAGE: 0xff0000,     // Vermelho
  MAGICAL_DAMAGE: 0xa200ff,      // Roxo
  FIRE_DAMAGE: 0xff6600,         // Laranja
  ICE_DAMAGE: 0x00ccff,          // Azul claro
  LIGHTNING_DAMAGE: 0xffff00,    // Amarelo
  POISON_DAMAGE: 0x00ff00,       // Verde
  HEAL: 0x00ff88,                // Verde-água
  MISS: 0xcccccc,                // Cinza
  CRITICAL: 0xff0088             // Rosa
}; 