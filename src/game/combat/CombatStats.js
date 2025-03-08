import { COMBAT_CONFIG } from './combatConfig';

/**
 * Classe que gerencia estatísticas de combate para entidades
 */
export class CombatStats {
  /**
   * @param {Object} initialStats - Estatísticas iniciais
   * @param {number} initialStats.maxHp - HP máximo
   * @param {number} initialStats.maxMp - MP máximo
   * @param {number} initialStats.attack - Poder de ataque
   * @param {number} initialStats.defense - Poder de defesa
   * @param {number} initialStats.level - Nível da entidade
   * @param {string} initialStats.type - Tipo da entidade (player/monster)
   */
  constructor(initialStats = {}) {
    // Valores padrão do sistema baseados no nível
    const level = initialStats.level || 1;
    const baseHp = COMBAT_CONFIG.BASE_HP + (COMBAT_CONFIG.HP_PER_LEVEL * (level - 1));
    const baseMp = COMBAT_CONFIG.BASE_MP + (COMBAT_CONFIG.MP_PER_LEVEL * (level - 1));
    const baseAttack = COMBAT_CONFIG.BASE_ATTACK + (COMBAT_CONFIG.ATTACK_PER_LEVEL * (level - 1));
    const baseDefense = COMBAT_CONFIG.BASE_DEFENSE + (COMBAT_CONFIG.DEFENSE_PER_LEVEL * (level - 1));
    
    // Valores principais
    this.maxHp = initialStats.maxHp || baseHp;
    this.maxMp = initialStats.maxMp || baseMp;
    this.hp = initialStats.hp || this.maxHp;
    this.mp = initialStats.mp || this.maxMp;
    
    // Atributos de combate
    this.attack = initialStats.attack || baseAttack;
    this.defense = initialStats.defense || baseDefense;
    this.level = level;
    
    // Atributos para cálculo de dano
    this.critChance = initialStats.critChance || COMBAT_CONFIG.CRITICAL_CHANCE;
    this.critMultiplier = initialStats.critMultiplier || COMBAT_CONFIG.CRITICAL_MULTIPLIER;
    this.attackRange = initialStats.attackRange || COMBAT_CONFIG.MELEE_RANGE;
    this.attackSpeed = initialStats.attackSpeed || 1.0;
    
    // Resistências elementais (%)
    this.resistances = initialStats.resistances || {
      physical: 0,
      magical: 0,
      fire: 0,
      ice: 0,
      lightning: 0,
      poison: 0
    };
    
    // Status
    this.isDead = false;
    
    // Estado do combate
    this.lastAttackTime = 0;
    this.attackCooldown = initialStats.attackCooldown || 
      COMBAT_CONFIG.DEFAULT_ATTACK_COOLDOWN / this.attackSpeed;
    
    // Eventos
    this.onDamageListeners = [];
    this.onHealListeners = [];
    this.onDeathListeners = [];
    this.onReviveListeners = [];
  }
  
  /**
   * Aplica dano à entidade
   * @param {number} amount - Quantidade de dano
   * @param {string} type - Tipo de dano
   * @param {string} attackerId - ID do atacante
   * @param {Object} options - Opções adicionais
   * @returns {Object} Informações sobre o dano aplicado
   */
  applyDamage(amount, type = 'physical', attackerId = null, options = {}) {
    if (this.isDead) return { damage: 0, absorbed: 0, targetDied: false };
    
    // Calcular resistência (se não for dano "true")
    let resistance = 0;
    let absorbedByDefense = 0;
    
    if (type !== 'true' && type !== 'TRUE') {
      // Aplicar defesa para dano físico
      if (type === 'physical' && this.defense > 0) {
        // Redução de dano baseada na defesa (fórmula simplificada)
        absorbedByDefense = Math.min(amount * 0.6, this.defense * 0.8);
      }
      
      // Aplicar resistência elemental
      if (this.resistances[type]) {
        resistance = this.resistances[type];
      }
    }
    
    // Calcular dano final
    const resistanceMultiplier = 1 - (resistance / 100);
    const finalDamage = Math.max(0, (amount - absorbedByDefense) * resistanceMultiplier);
    const roundedDamage = Math.round(finalDamage);
    
    // Aplicar dano
    this.hp = Math.max(0, this.hp - roundedDamage);
    
    // Verificar morte
    const targetDied = this.hp <= 0;
    if (targetDied && !this.isDead) {
      this.die();
    }
    
    // Notificar listeners
    this._notifyDamageListeners(roundedDamage, type, attackerId, options);
    
    return {
      damage: roundedDamage,
      absorbed: absorbedByDefense + (amount - finalDamage),
      targetDied,
      critical: options.critical || false
    };
  }
  
  /**
   * Aplica cura à entidade
   * @param {number} amount - Quantidade de cura
   * @param {string} healerId - ID do curador
   * @param {Object} options - Opções adicionais
   * @returns {number} Quantidade de HP curado
   */
  heal(amount, healerId = null, options = {}) {
    if (this.isDead) return 0;
    
    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healAmount = this.hp - oldHp;
    
    // Notificar listeners
    this._notifyHealListeners(healAmount, healerId, options);
    
    return healAmount;
  }
  
  /**
   * Consome MP da entidade
   * @param {number} amount - Quantidade de MP
   * @returns {boolean} Se foi possível consumir
   */
  consumeMp(amount) {
    if (this.mp < amount) return false;
    this.mp -= amount;
    return true;
  }
  
  /**
   * Restaura MP da entidade
   * @param {number} amount - Quantidade de MP
   * @returns {number} Quantidade restaurada
   */
  restoreMp(amount) {
    const oldMp = this.mp;
    this.mp = Math.min(this.maxMp, this.mp + amount);
    return this.mp - oldMp;
  }
  
  /**
   * Verifica se a entidade pode atacar
   * @param {number} currentTime - Tempo atual
   * @returns {boolean} Se pode atacar
   */
  canAttack(currentTime = Date.now()) {
    return !this.isDead && (currentTime - this.lastAttackTime >= this.attackCooldown);
  }
  
  /**
   * Registra um ataque realizado
   * @param {number} currentTime - Tempo atual
   */
  registerAttack(currentTime = Date.now()) {
    this.lastAttackTime = currentTime;
  }
  
  /**
   * Mata a entidade
   */
  die() {
    if (this.isDead) return;
    
    this.isDead = true;
    this.hp = 0;
    
    // Notificar listeners
    this._notifyDeathListeners();
  }
  
  /**
   * Revive a entidade
   * @param {number} healthPercent - Porcentagem de vida com que a entidade revive (0-100)
   */
  revive(healthPercent = 100) {
    if (!this.isDead) return;
    
    this.isDead = false;
    this.hp = Math.max(1, Math.floor(this.maxHp * (healthPercent / 100)));
    
    // Notificar listeners
    this._notifyReviveListeners();
  }
  
  /**
   * Adiciona um listener para evento de dano
   * @param {Function} listener - Função de callback
   */
  onDamage(listener) {
    this.onDamageListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para evento de cura
   * @param {Function} listener - Função de callback
   */
  onHeal(listener) {
    this.onHealListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para evento de morte
   * @param {Function} listener - Função de callback
   */
  onDeath(listener) {
    this.onDeathListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para evento de revive
   * @param {Function} listener - Função de callback
   */
  onRevive(listener) {
    this.onReviveListeners.push(listener);
  }
  
  /**
   * Notifica listeners de dano
   * @private
   */
  _notifyDamageListeners(amount, type, attackerId, options) {
    for (const listener of this.onDamageListeners) {
      listener(amount, type, attackerId, options);
    }
  }
  
  /**
   * Notifica listeners de cura
   * @private
   */
  _notifyHealListeners(amount, healerId, options) {
    for (const listener of this.onHealListeners) {
      listener(amount, healerId, options);
    }
  }
  
  /**
   * Notifica listeners de morte
   * @private
   */
  _notifyDeathListeners() {
    for (const listener of this.onDeathListeners) {
      listener();
    }
  }
  
  /**
   * Notifica listeners de revive
   * @private
   */
  _notifyReviveListeners() {
    for (const listener of this.onReviveListeners) {
      listener();
    }
  }
  
  /**
   * Retorna estatísticas atuais para serialização
   * @returns {Object} Dados serializáveis
   */
  getSerializableData() {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      attack: this.attack,
      defense: this.defense,
      level: this.level,
      isDead: this.isDead
    };
  }
} 