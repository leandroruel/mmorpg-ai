import { COMBAT_CONFIG, DAMAGE_TYPES } from './combatConfig';
import { DamageCalculator } from './DamageCalculator';
import { StatusEffect, StatusEffectManager } from './StatusEffect';
import { CombatStats } from './CombatStats';

/**
 * Sistema de combate principal que gerencia todas as
 * interações de combate entre entidades
 */
export class CombatSystem {
  /**
   * @param {Object} game - Instância principal do jogo
   */
  constructor(game) {
    this.game = game;
    this.entities = new Map(); // entityId -> entityData
    this.onAttackListeners = [];
    this.onDamageListeners = [];
    this.onDeathListeners = [];
    this.onHealListeners = [];
    
    // Cache
    this._lastAttackTime = {};  // entityId -> timestamp
  }
  
  /**
   * Inicializa o sistema de combate
   */
  init() {
    console.log('[CombatSystem] Inicializando sistema de combate');
    
    // Inicializar listeners para eventos do jogo
    this._setupEventListeners();
  }
  
  /**
   * Prepara uma entidade para combate, adicionando as propriedades necessárias
   * @param {Object} entity - Entidade a ser preparada
   * @param {Object} options - Opções de configuração
   */
  setupEntity(entity, options = {}) {
    if (!entity || !entity.id) {
      console.error('[CombatSystem] Tentativa de configurar entidade inválida para combate');
      return;
    }
    
    // Verificar se a entidade já está configurada
    if (this.entities.has(entity.id)) {
      return;
    }
    
    // Criar estatísticas de combate se não existirem
    if (!entity.combatStats) {
      const initialStats = {
        level: options.level || entity.level || 1,
        type: entity.type || 'unknown'
      };
      
      // Adicionar outras estatísticas se fornecidas
      if (options.stats) {
        Object.assign(initialStats, options.stats);
      }
      
      entity.combatStats = new CombatStats(initialStats);
    }
    
    // Adicionar gerenciador de efeitos de status se não existir
    if (!entity.statusEffects) {
      entity.statusEffects = new StatusEffectManager(entity);
    }
    
    // Registrar callbacks para eventos de combate
    entity.combatStats.onDamage((amount, type, attackerId, options) => {
      this._handleEntityDamaged(entity, amount, type, attackerId, options);
    });
    
    entity.combatStats.onDeath(() => {
      this._handleEntityDeath(entity);
    });
    
    // Registrar entidade no sistema de combate
    this.entities.set(entity.id, {
      entity,
      attackTargets: new Set() // IDs das entidades que esta entidade está atacando atualmente
    });
    
    console.log(`[CombatSystem] Entidade configurada para combate: ${entity.id}`);
  }
  
  /**
   * Remove uma entidade do sistema de combate
   * @param {string} entityId - ID da entidade
   */
  removeEntity(entityId) {
    if (!this.entities.has(entityId)) return;
    
    // Remover do sistema
    this.entities.delete(entityId);
    delete this._lastAttackTime[entityId];
    
    console.log(`[CombatSystem] Entidade removida do sistema de combate: ${entityId}`);
  }
  
  /**
   * Processa um ataque básico de uma entidade em outra
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} options - Opções de ataque
   * @returns {Object} Resultado do ataque
   */
  processAttack(attacker, target, options = {}) {
    if (!attacker || !target) {
      return { success: false, message: 'Entidades inválidas para ataque' };
    }
    
    // Garantir que ambas entidades estão registradas no sistema
    this.setupEntity(attacker);
    this.setupEntity(target);
    
    // Validar o ataque
    const validation = DamageCalculator.validateAttack(attacker, target, options);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.reason,
        attackerId: attacker.id,
        targetId: target.id
      };
    }
    
    // Verificar se pode atacar novamente (cooldown)
    const currentTime = Date.now();
    if (!attacker.combatStats.canAttack(currentTime)) {
      return {
        success: false,
        message: 'Ainda em cooldown de ataque',
        attackerId: attacker.id,
        targetId: target.id,
        cooldown: true
      };
    }
    
    // Registrar o momento do ataque
    attacker.combatStats.registerAttack(currentTime);
    this._lastAttackTime[attacker.id] = currentTime;
    
    // Calcular dano
    const damageResult = DamageCalculator.calculateBasicAttackDamage(attacker, target, options);
    
    // Aplicar dano
    const result = target.combatStats.applyDamage(
      damageResult.damage,
      damageResult.type,
      attacker.id,
      { critical: damageResult.critical, ...options }
    );
    
    // Registrar que esta entidade está atacando o alvo
    const attackerData = this.entities.get(attacker.id);
    if (attackerData) {
      attackerData.attackTargets.add(target.id);
    }
    
    // Notificar evento de ataque
    this._notifyAttack(attacker, target, {
      damage: result.damage,
      type: damageResult.type,
      critical: damageResult.critical,
      absorbed: result.absorbed,
      targetDied: result.targetDied,
      ...options
    });
    
    return {
      success: true,
      damage: result.damage,
      attackerId: attacker.id,
      targetId: target.id,
      critical: damageResult.critical,
      targetDied: result.targetDied,
      type: damageResult.type
    };
  }
  
  /**
   * Processa um ataque usando uma habilidade
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} skill - Habilidade usada
   * @param {Object} options - Opções adicionais
   * @returns {Object} Resultado do ataque
   */
  processSkillUse(attacker, target, skill, options = {}) {
    if (!attacker || !target || !skill) {
      return { success: false, message: 'Parâmetros inválidos para uso de habilidade' };
    }
    
    // Garantir que ambas entidades estão registradas no sistema
    this.setupEntity(attacker);
    this.setupEntity(target);
    
    // Verificar custo de MP
    if (skill.mpCost && !attacker.combatStats.consumeMp(skill.mpCost)) {
      return {
        success: false,
        message: 'MP insuficiente',
        attackerId: attacker.id,
        targetId: target.id,
        skillId: skill.id
      };
    }
    
    // Verificar cooldown de habilidade (implementar sistema de cooldown de skills)
    // ...
    
    // Validar a habilidade (verificar alcance, etc)
    const customOptions = {
      range: skill.range,
      ignoreRange: skill.ignoreRange,
      canTargetDead: skill.canTargetDead,
      ...options
    };
    
    const validation = DamageCalculator.validateAttack(attacker, target, customOptions);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.reason,
        attackerId: attacker.id,
        targetId: target.id,
        skillId: skill.id
      };
    }
    
    // Calcular dano da habilidade
    const damageResult = DamageCalculator.calculateSkillDamage(attacker, target, skill, options);
    
    // Aplicar dano
    const result = target.combatStats.applyDamage(
      damageResult.damage,
      damageResult.type,
      attacker.id,
      { critical: damageResult.critical, skillId: skill.id, ...options }
    );
    
    // Aplicar efeitos da habilidade, se houver
    if (skill.effects) {
      this._applySkillEffects(attacker, target, skill);
    }
    
    // Notificar evento de ataque com habilidade
    this._notifyAttack(attacker, target, {
      damage: result.damage,
      type: damageResult.type,
      critical: damageResult.critical,
      absorbed: result.absorbed,
      targetDied: result.targetDied,
      skillId: skill.id,
      ...options
    });
    
    return {
      success: true,
      damage: result.damage,
      attackerId: attacker.id,
      targetId: target.id,
      critical: damageResult.critical,
      targetDied: result.targetDied,
      type: damageResult.type,
      skillId: skill.id
    };
  }
  
  /**
   * Aplica dano direto a uma entidade (sem atacante)
   * @param {Object} target - Entidade alvo
   * @param {number} amount - Quantidade de dano
   * @param {string} type - Tipo de dano (physical, magical, etc)
   * @param {string} sourceId - ID da fonte de dano (opcional)
   * @param {Object} options - Opções adicionais
   * @returns {Object} Resultado do dano
   */
  applyDamage(target, amount, type = DAMAGE_TYPES.PHYSICAL, sourceId = null, options = {}) {
    if (!target) {
      return { success: false, message: 'Alvo inválido para aplicar dano' };
    }
    
    // Garantir que a entidade está registrada no sistema
    this.setupEntity(target);
    
    // Aplicar dano diretamente
    const result = target.combatStats.applyDamage(amount, type, sourceId, options);
    
    return {
      success: true,
      damage: result.damage,
      targetId: target.id,
      targetDied: result.targetDied,
      type
    };
  }
  
  /**
   * Aplica cura a uma entidade
   * @param {Object} target - Entidade alvo
   * @param {number} amount - Quantidade de cura
   * @param {string} healerId - ID do curador (opcional)
   * @param {Object} options - Opções adicionais
   * @returns {Object} Resultado da cura
   */
  applyHeal(target, amount, healerId = null, options = {}) {
    if (!target) {
      return { success: false, message: 'Alvo inválido para aplicar cura' };
    }
    
    // Garantir que a entidade está registrada no sistema
    this.setupEntity(target);
    
    // Aplicar cura
    const healAmount = target.combatStats.heal(amount, healerId, options);
    
    // Notificar evento de cura
    this._notifyHeal(target, healAmount, healerId, options);
    
    return {
      success: true,
      healAmount,
      targetId: target.id,
      healerId
    };
  }
  
  /**
   * Aplica um efeito de status a uma entidade
   * @param {Object} target - Entidade alvo
   * @param {StatusEffect} effect - Efeito a aplicar
   * @param {Object} source - Fonte do efeito
   * @param {Object} options - Opções adicionais
   * @returns {Object} Resultado da aplicação
   */
  applyStatusEffect(target, effect, source = null, options = {}) {
    if (!target || !effect) {
      return { success: false, message: 'Parâmetros inválidos para aplicar efeito' };
    }
    
    // Garantir que a entidade está registrada no sistema
    this.setupEntity(target);
    
    // Aplicar efeito
    const result = target.statusEffects.applyEffect(effect, source, options);
    
    return {
      success: !!result,
      effectId: effect.id,
      targetId: target.id,
      sourceId: source ? source.id : null
    };
  }
  
  /**
   * Atualiza o sistema de combate
   * @param {number} deltaTime - Tempo desde a última atualização
   */
  update(deltaTime) {
    // Atualizar efeitos de status de todas as entidades
    for (const [entityId, data] of this.entities.entries()) {
      const entity = data.entity;
      
      // Atualizar efeitos de status
      if (entity.statusEffects) {
        entity.statusEffects.update(deltaTime);
      }
    }
  }
  
  /**
   * Adiciona um listener para eventos de ataque
   * @param {Function} listener - Função de callback
   */
  onAttack(listener) {
    this.onAttackListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para eventos de dano
   * @param {Function} listener - Função de callback
   */
  onDamage(listener) {
    this.onDamageListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para eventos de morte
   * @param {Function} listener - Função de callback
   */
  onDeath(listener) {
    this.onDeathListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para eventos de cura
   * @param {Function} listener - Função de callback
   */
  onHeal(listener) {
    this.onHealListeners.push(listener);
  }
  
  /**
   * Configura listeners para eventos do jogo
   * @private
   */
  _setupEventListeners() {
    // Aqui conectamos com os eventos do jogo principal
    if (this.game && this.game.network) {
      // Exemplo: processar evento de ataque vindo da rede
      this.game.network.on('playerAttack', (data) => {
        const attackerId = data.attackerId;
        const targetId = data.targetId;
        const attacker = this.game.entityManager.getEntityById(attackerId);
        const target = this.game.entityManager.getEntityById(targetId);
        
        if (attacker && target) {
          this.processAttack(attacker, target, data.options || {});
        }
      });
      
      // Exemplo: processar evento de uso de habilidade
      this.game.network.on('playerUseSkill', (data) => {
        const attackerId = data.attackerId;
        const targetId = data.targetId;
        const skillId = data.skillId;
        
        const attacker = this.game.entityManager.getEntityById(attackerId);
        const target = this.game.entityManager.getEntityById(targetId);
        
        // Obter definição da habilidade (implementar sistema de habilidades)
        const skill = this._getSkillById(skillId);
        
        if (attacker && target && skill) {
          this.processSkillUse(attacker, target, skill, data.options || {});
        }
      });
    }
  }
  
  /**
   * Aplica efeitos de uma habilidade
   * @param {Object} attacker - Entidade atacante
   * @param {Object} target - Entidade alvo
   * @param {Object} skill - Habilidade usada
   * @private
   */
  _applySkillEffects(attacker, target, skill) {
    if (!skill.effects || !Array.isArray(skill.effects)) return;
    
    for (const effectConfig of skill.effects) {
      // Criar instância do efeito
      const effect = new StatusEffect({
        id: effectConfig.id,
        name: effectConfig.name,
        description: effectConfig.description,
        type: effectConfig.type,
        duration: effectConfig.duration,
        effects: effectConfig.effects,
        onApply: effectConfig.onApply,
        onRemove: effectConfig.onRemove,
        onTick: effectConfig.onTick,
        tickInterval: effectConfig.tickInterval,
        isStackable: effectConfig.isStackable,
        maxStacks: effectConfig.maxStacks,
        iconUrl: effectConfig.iconUrl
      });
      
      // Aplicar efeito
      this.applyStatusEffect(target, effect, attacker);
    }
  }
  
  /**
   * Manipula evento de dano em uma entidade
   * @private
   */
  _handleEntityDamaged(entity, amount, type, attackerId, options) {
    // Lógica adicional quando uma entidade recebe dano
    
    // Notificar listeners
    this._notifyDamage(entity, amount, type, attackerId, options);
    
    // Se for um monstro, torná-lo agressivo contra o atacante
    if (entity.type === 'monster' && attackerId && !entity.combatStats.isDead) {
      const attacker = this.game.entityManager.getEntityById(attackerId);
      if (attacker && entity.ai) {
        entity.ai.setAggroTarget(attackerId);
      }
    }
  }
  
  /**
   * Manipula evento de morte de uma entidade
   * @private
   */
  _handleEntityDeath(entity) {
    // Lógica adicional quando uma entidade morre
    console.log(`[CombatSystem] Entidade morreu: ${entity.id}`);
    
    // Remover a entidade como alvo de outros atacantes
    for (const [attackerId, data] of this.entities.entries()) {
      if (data.attackTargets.has(entity.id)) {
        data.attackTargets.delete(entity.id);
      }
    }
    
    // Notificar listeners
    this._notifyDeath(entity);
    
    // Lógica específica por tipo de entidade
    if (entity.type === 'monster') {
      // Lógica para morte de monstro
      // Ex: recompensas, respawn, etc.
    } else if (entity.type === 'player') {
      // Lógica para morte de jogador
      // Ex: penalidades, respawn, etc.
    }
  }
  
  /**
   * Obtém uma habilidade pelo ID
   * @param {string} skillId - ID da habilidade
   * @returns {Object} Definição da habilidade
   * @private
   */
  _getSkillById(skillId) {
    // Implementar sistema para obter definição de habilidades
    // Pode ser um objeto Skills no game ou um sistema dedicado
    if (this.game && this.game.skillManager) {
      return this.game.skillManager.getSkillById(skillId);
    }
    
    // Provisório: retornar habilidade teste
    return {
      id: skillId,
      name: 'Habilidade Teste',
      mpCost: 10,
      baseDamage: 50,
      scaling: { attack: 1.5 },
      damageType: DAMAGE_TYPES.MAGICAL,
      range: 10,
      cooldown: 5000
    };
  }
  
  /**
   * Notifica evento de ataque
   * @private
   */
  _notifyAttack(attacker, target, details) {
    for (const listener of this.onAttackListeners) {
      try {
        listener(attacker, target, details);
      } catch (error) {
        console.error('Erro em listener de ataque:', error);
      }
    }
  }
  
  /**
   * Notifica evento de dano
   * @private
   */
  _notifyDamage(entity, amount, type, attackerId, options) {
    for (const listener of this.onDamageListeners) {
      try {
        listener(entity, amount, type, attackerId, options);
      } catch (error) {
        console.error('Erro em listener de dano:', error);
      }
    }
  }
  
  /**
   * Notifica evento de morte
   * @private
   */
  _notifyDeath(entity) {
    for (const listener of this.onDeathListeners) {
      try {
        listener(entity);
      } catch (error) {
        console.error('Erro em listener de morte:', error);
      }
    }
  }
  
  /**
   * Notifica evento de cura
   * @private
   */
  _notifyHeal(entity, amount, healerId, options) {
    for (const listener of this.onHealListeners) {
      try {
        listener(entity, amount, healerId, options);
      } catch (error) {
        console.error('Erro em listener de cura:', error);
      }
    }
  }
} 