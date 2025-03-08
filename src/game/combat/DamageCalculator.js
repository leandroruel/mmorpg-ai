import { COMBAT_CONFIG, DAMAGE_TYPES } from './combatConfig';

/**
 * Classe responsável por calcular dano em combate
 */
export class DamageCalculator {
  /**
   * Calcula o dano básico baseado em estatísticas
   * 
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} options - Opções de ataque
   * @returns {Object} Informações do cálculo de dano
   */
  static calculateBasicAttackDamage(attacker, target, options = {}) {
    // Obtém as estatísticas relevantes
    const attackerStats = attacker.combatStats;
    const targetStats = target.combatStats;
    
    if (!attackerStats || !targetStats) {
      console.error('CombatStats não encontrado para entidades em calculateDamage');
      return { 
        damage: 0, 
        type: DAMAGE_TYPES.PHYSICAL,
        critical: false 
      };
    }
    
    // Cálculo de dano base (ataque do atacante)
    let baseDamage = attackerStats.attack;
    
    // Variação aleatória (±10%)
    const randomFactor = 0.9 + (Math.random() * 0.2);
    baseDamage *= randomFactor;
    
    // Verificar acerto crítico
    const criticalRoll = Math.random() * 100;
    const isCritical = criticalRoll <= attackerStats.critChance;
    
    // Aplicar multiplicador de crítico se necessário
    if (isCritical) {
      baseDamage *= attackerStats.critMultiplier;
    }
    
    // Aplicar modificadores específicos de habilidade (se houver)
    if (options.damageMultiplier) {
      baseDamage *= options.damageMultiplier;
    }
    
    // Tipo de dano (padrão: físico)
    const damageType = options.damageType || DAMAGE_TYPES.PHYSICAL;
    
    return {
      damage: Math.round(baseDamage),
      type: damageType,
      critical: isCritical
    };
  }
  
  /**
   * Calcula o dano de uma habilidade específica
   * 
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} skill - Habilidade usada
   * @param {Object} options - Opções adicionais
   * @returns {Object} Informações do cálculo de dano
   */
  static calculateSkillDamage(attacker, target, skill, options = {}) {
    // Obtém as estatísticas relevantes
    const attackerStats = attacker.combatStats;
    const targetStats = target.combatStats;
    
    if (!attackerStats || !targetStats || !skill) {
      console.error('Dados incompletos em calculateSkillDamage');
      return { 
        damage: 0, 
        type: DAMAGE_TYPES.PHYSICAL,
        critical: false 
      };
    }
    
    // Cálculo de dano base pela skill
    let baseDamage = skill.baseDamage || attackerStats.attack;
    
    // Aplicar escalamento por atributos
    if (skill.scaling) {
      if (skill.scaling.attack) {
        baseDamage += attackerStats.attack * skill.scaling.attack;
      }
      
      // Outros atributos podem ser adicionados aqui (ex: inteligência, etc)
    }
    
    // Variação aleatória menor para skills (±5%)
    const randomFactor = 0.95 + (Math.random() * 0.1);
    baseDamage *= randomFactor;
    
    // Verificar acerto crítico (chance pode ser modificada pela skill)
    const critChance = skill.critChanceBonus ? 
      attackerStats.critChance + skill.critChanceBonus : 
      attackerStats.critChance;
      
    const criticalRoll = Math.random() * 100;
    const isCritical = criticalRoll <= critChance;
    
    // Aplicar multiplicador de crítico (pode ser modificado pela skill)
    if (isCritical) {
      const critMultiplier = skill.critMultiplier || attackerStats.critMultiplier;
      baseDamage *= critMultiplier;
    }
    
    // Tipo de dano da skill
    const damageType = skill.damageType || DAMAGE_TYPES.PHYSICAL;
    
    return {
      damage: Math.round(baseDamage),
      type: damageType,
      critical: isCritical,
      skillId: skill.id
    };
  }
  
  /**
   * Verifica se um ataque está em alcance
   * 
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} options - Opções de ataque
   * @returns {boolean} Se está em alcance
   */
  static isInRange(attacker, target, options = {}) {
    if (!attacker || !target || !attacker.position || !target.position) {
      console.error('Dados de posição incompletos para verificação de alcance');
      return false;
    }
    
    // Calcular distância entre atacante e alvo
    const dx = attacker.position.x - target.position.x;
    const dy = attacker.position.y - target.position.y;
    const dz = (attacker.position.z || 0) - (target.position.z || 0);
    
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distanceSquared);
    
    // Obter alcance de ataque (com tolerância)
    const attackerStats = attacker.combatStats;
    let attackRange = options.range || (attackerStats ? attackerStats.attackRange : COMBAT_CONFIG.MELEE_RANGE);
    
    // Aplicar tolerância configurada
    attackRange *= (1 + COMBAT_CONFIG.ATTACK_RANGE_TOLERANCE);
    
    // Adicionar raio do alvo ao cálculo
    const targetRadius = target.radius || 0.5;
    
    return distance <= (attackRange + targetRadius);
  }
  
  /**
   * Verifica condições para um ataque
   * 
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} options - Opções de ataque
   * @returns {Object} Resultado da verificação
   */
  static validateAttack(attacker, target, options = {}) {
    // Verificar se entidades são válidas
    if (!attacker || !target) {
      return { valid: false, reason: 'Entidades inválidas' };
    }
    
    // Verificar se atacante está vivo
    if (attacker.combatStats && attacker.combatStats.isDead) {
      return { valid: false, reason: 'Atacante está morto' };
    }
    
    // Verificar se alvo está vivo (a menos que a opção permita atacar mortos)
    if (!options.canTargetDead && target.combatStats && target.combatStats.isDead) {
      return { valid: false, reason: 'Alvo está morto' };
    }
    
    // Verificar cooldown de ataque
    if (attacker.combatStats && !attacker.combatStats.canAttack(Date.now())) {
      return { valid: false, reason: 'Atacante em cooldown' };
    }
    
    // Verificar alcance
    if (!options.ignoreRange && !this.isInRange(attacker, target, options)) {
      return { valid: false, reason: 'Alvo fora de alcance' };
    }
    
    // Pode haver mais verificações baseadas em estados do jogo
    // ...
    
    return { valid: true };
  }
} 