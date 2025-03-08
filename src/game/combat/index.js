/**
 * Index que exporta todo o sistema de combate
 */

// Configurações
export { COMBAT_CONFIG, DAMAGE_TYPES, SKILL_TYPES, COMBAT_COLORS } from './combatConfig';

// Classes principais
export { CombatSystem } from './CombatSystem';
export { CombatStats } from './CombatStats';
export { DamageCalculator } from './DamageCalculator';
export { StatusEffect, StatusEffectManager } from './StatusEffect';

// Importação interna para uso na função
import { CombatSystem } from './CombatSystem';

// Utilitários (futuros)
// export { CombatUtils } from './CombatUtils';
// export { SkillManager } from './SkillManager';

/**
 * Função de inicialização do sistema de combate
 * @param {Object} game - Instância principal do jogo
 * @returns {CombatSystem} - Instância do sistema de combate
 */
export function initCombatSystem(game) {
  // Criar e inicializar o sistema de combate
  try {
    console.log('[Combat] Inicializando sistema de combate...');
    const combatSystem = new CombatSystem(game);
    combatSystem.init();
    
    // Integrar com o ciclo de atualização do jogo
    if (game.registerUpdateHandler) {
      game.registerUpdateHandler('combat', (deltaTime) => {
        combatSystem.update(deltaTime);
      });
    }
    
    console.log('[Combat] Sistema de combate inicializado com sucesso');
    return combatSystem;
  } catch (error) {
    console.error('[Combat] Erro ao inicializar sistema de combate:', error);
    // Retornar um sistema de combate vazio para evitar erros
    return {
      setupEntity: () => {},
      processAttack: () => ({ success: false, message: 'Sistema de combate não disponível' }),
      update: () => {},
      onAttack: () => {},
      onDamage: () => {},
      onDeath: () => {},
      onHeal: () => {}
    };
  }
} 