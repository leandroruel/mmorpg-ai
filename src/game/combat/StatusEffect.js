/**
 * Classe que representa um efeito de status (buff/debuff)
 */
export class StatusEffect {
  /**
   * @param {Object} config - Configuração do efeito
   * @param {string} config.id - ID único do efeito
   * @param {string} config.name - Nome do efeito
   * @param {string} config.description - Descrição do efeito
   * @param {string} config.type - Tipo do efeito (buff, debuff)
   * @param {number} config.duration - Duração em milissegundos (0 = permanente até ser removido)
   * @param {Object} config.effects - Efeitos do status
   * @param {Function} config.onApply - Função chamada quando efeito é aplicado
   * @param {Function} config.onRemove - Função chamada quando efeito é removido
   * @param {Function} config.onTick - Função chamada a cada tick
   * @param {number} config.tickInterval - Intervalo entre ticks em ms (padrão: 1000ms)
   * @param {boolean} config.isStackable - Se o efeito pode acumular
   * @param {number} config.maxStacks - Número máximo de acumulações
   * @param {string} config.iconUrl - URL do ícone (opcional)
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.type = config.type || 'buff';
    this.duration = config.duration || 0;
    this.effects = config.effects || {};
    this.onApply = config.onApply || (() => {});
    this.onRemove = config.onRemove || (() => {});
    this.onTick = config.onTick || (() => {});
    this.tickInterval = config.tickInterval || 1000;
    this.isStackable = config.isStackable || false;
    this.maxStacks = config.maxStacks || 1;
    this.iconUrl = config.iconUrl || '';
    
    // Estado interno
    this.target = null;
    this.source = null;
    this.startTime = 0;
    this.endTime = 0;
    this.stacks = 1;
    this.tickTimer = null;
    this.isActive = false;
  }
  
  /**
   * Aplica o efeito a um alvo
   * @param {Object} target - Alvo do efeito
   * @param {Object} source - Fonte do efeito
   * @param {Object} options - Opções adicionais
   * @returns {boolean} Se o efeito foi aplicado com sucesso
   */
  apply(target, source = null, options = {}) {
    if (!target) return false;
    
    this.target = target;
    this.source = source;
    this.startTime = Date.now();
    this.endTime = this.duration > 0 ? this.startTime + this.duration : 0;
    this.stacks = options.stacks || 1;
    this.isActive = true;
    
    // Executar lógica de aplicação
    try {
      this.onApply(this.target, this.source, this);
    } catch (error) {
      console.error(`Erro ao aplicar efeito ${this.id}:`, error);
    }
    
    // Iniciar timer para remoção
    if (this.duration > 0) {
      this._scheduleRemoval();
    }
    
    // Iniciar timer para ticks
    this._startTickTimer();
    
    return true;
  }
  
  /**
   * Remove o efeito do alvo
   */
  remove() {
    if (!this.isActive) return;
    
    // Limpar timers
    this._clearTimers();
    
    // Executar lógica de remoção
    try {
      this.onRemove(this.target, this.source, this);
    } catch (error) {
      console.error(`Erro ao remover efeito ${this.id}:`, error);
    }
    
    this.isActive = false;
  }
  
  /**
   * Adiciona stacks ao efeito
   * @param {number} amount - Quantidade a adicionar
   * @returns {number} Novo número de stacks
   */
  addStacks(amount = 1) {
    if (!this.isStackable || !this.isActive) return this.stacks;
    
    const oldStacks = this.stacks;
    this.stacks = Math.min(this.maxStacks, this.stacks + amount);
    
    return this.stacks;
  }
  
  /**
   * Remove stacks do efeito
   * @param {number} amount - Quantidade a remover
   * @returns {number} Novo número de stacks
   */
  removeStacks(amount = 1) {
    if (!this.isStackable || !this.isActive) return this.stacks;
    
    const oldStacks = this.stacks;
    this.stacks = Math.max(0, this.stacks - amount);
    
    // Se remover todas as stacks, remover o efeito
    if (this.stacks === 0) {
      this.remove();
    }
    
    return this.stacks;
  }
  
  /**
   * Estende a duração do efeito
   * @param {number} additionalDuration - Tempo adicional em ms
   */
  extendDuration(additionalDuration) {
    if (!this.isActive || this.duration === 0) return;
    
    // Recalcular tempo de fim
    this.endTime += additionalDuration;
    
    // Reagendar remoção
    this._clearRemovalTimer();
    this._scheduleRemoval();
  }
  
  /**
   * Reinicia a duração do efeito
   */
  refreshDuration() {
    if (!this.isActive || this.duration === 0) return;
    
    this.startTime = Date.now();
    this.endTime = this.startTime + this.duration;
    
    // Reagendar remoção
    this._clearRemovalTimer();
    this._scheduleRemoval();
  }
  
  /**
   * Verifica se o efeito está expirado
   * @returns {boolean} Se está expirado
   */
  isExpired() {
    return this.duration > 0 && Date.now() > this.endTime;
  }
  
  /**
   * Retorna o tempo restante do efeito
   * @returns {number} Tempo restante em ms
   */
  getRemainingTime() {
    if (!this.isActive || this.duration === 0) return 0;
    
    return Math.max(0, this.endTime - Date.now());
  }
  
  /**
   * Executa um tick do efeito
   */
  tick() {
    if (!this.isActive) return;
    
    try {
      this.onTick(this.target, this.source, this);
    } catch (error) {
      console.error(`Erro no tick do efeito ${this.id}:`, error);
    }
  }
  
  /**
   * Agenda a remoção automática do efeito
   * @private
   */
  _scheduleRemoval() {
    if (this.duration <= 0) return;
    
    this.removalTimer = setTimeout(() => {
      this.remove();
    }, this.duration);
  }
  
  /**
   * Inicia o timer de ticks
   * @private
   */
  _startTickTimer() {
    if (!this.onTick || this.tickInterval <= 0) return;
    
    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.tickInterval);
  }
  
  /**
   * Limpa o timer de remoção
   * @private
   */
  _clearRemovalTimer() {
    if (this.removalTimer) {
      clearTimeout(this.removalTimer);
      this.removalTimer = null;
    }
  }
  
  /**
   * Limpa todos os timers
   * @private
   */
  _clearTimers() {
    this._clearRemovalTimer();
    
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
  
  /**
   * Retorna dados serializáveis do efeito
   * @returns {Object} Dados do efeito
   */
  getSerializableData() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      duration: this.duration,
      remainingTime: this.getRemainingTime(),
      stacks: this.stacks,
      iconUrl: this.iconUrl,
      description: this.description
    };
  }
}

/**
 * Classe para gerenciar múltiplos efeitos de status em uma entidade
 */
export class StatusEffectManager {
  /**
   * @param {Object} entity - Entidade que terá os efeitos
   */
  constructor(entity) {
    this.entity = entity;
    this.effects = new Map(); // id -> StatusEffect
    this.onEffectAddedListeners = [];
    this.onEffectRemovedListeners = [];
    this.onEffectUpdatedListeners = [];
  }
  
  /**
   * Aplica um efeito à entidade
   * @param {StatusEffect} effect - Efeito a aplicar
   * @param {Object} source - Fonte do efeito
   * @param {Object} options - Opções adicionais
   * @returns {StatusEffect} O efeito aplicado ou atualizado
   */
  applyEffect(effect, source = null, options = {}) {
    if (!effect) return null;
    
    // Verificar se já existe um efeito com este ID
    const existingEffect = this.effects.get(effect.id);
    
    if (existingEffect) {
      // Se for stackable, adicionar stacks
      if (existingEffect.isStackable) {
        existingEffect.addStacks(effect.stacks || 1);
        this._notifyEffectUpdated(existingEffect);
      } 
      // Senão, apenas refreshar a duração
      else {
        existingEffect.refreshDuration();
        this._notifyEffectUpdated(existingEffect);
      }
      
      return existingEffect;
    } 
    // Efeito novo, aplicar
    else {
      effect.apply(this.entity, source, options);
      this.effects.set(effect.id, effect);
      this._notifyEffectAdded(effect);
      return effect;
    }
  }
  
  /**
   * Remove um efeito pelo ID
   * @param {string} effectId - ID do efeito
   * @returns {boolean} Se o efeito foi removido
   */
  removeEffect(effectId) {
    const effect = this.effects.get(effectId);
    if (!effect) return false;
    
    effect.remove();
    this.effects.delete(effectId);
    this._notifyEffectRemoved(effect);
    
    return true;
  }
  
  /**
   * Remove todos os efeitos que correspondem a um filtro
   * @param {Function} filterFn - Função de filtro
   * @returns {number} Quantidade de efeitos removidos
   */
  removeEffects(filterFn) {
    let count = 0;
    
    for (const [id, effect] of this.effects.entries()) {
      if (filterFn(effect)) {
        effect.remove();
        this.effects.delete(id);
        this._notifyEffectRemoved(effect);
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Remove todos os efeitos
   */
  removeAllEffects() {
    for (const effect of this.effects.values()) {
      effect.remove();
      this._notifyEffectRemoved(effect);
    }
    
    this.effects.clear();
  }
  
  /**
   * Verifica se a entidade tem um efeito específico
   * @param {string} effectId - ID do efeito
   * @returns {boolean} Se tem o efeito
   */
  hasEffect(effectId) {
    return this.effects.has(effectId);
  }
  
  /**
   * Obtém um efeito pelo ID
   * @param {string} effectId - ID do efeito
   * @returns {StatusEffect} O efeito ou null
   */
  getEffect(effectId) {
    return this.effects.get(effectId) || null;
  }
  
  /**
   * Obtém todos os efeitos de um tipo
   * @param {string} type - Tipo de efeito
   * @returns {Array<StatusEffect>} Lista de efeitos
   */
  getEffectsByType(type) {
    const result = [];
    
    for (const effect of this.effects.values()) {
      if (effect.type === type) {
        result.push(effect);
      }
    }
    
    return result;
  }
  
  /**
   * Atualiza todos os efeitos
   * @param {number} deltaTime - Tempo desde a última atualização
   */
  update(deltaTime) {
    // Verificar efeitos expirados
    for (const [id, effect] of this.effects.entries()) {
      if (effect.isExpired()) {
        effect.remove();
        this.effects.delete(id);
        this._notifyEffectRemoved(effect);
      }
    }
  }
  
  /**
   * Adiciona um listener para quando um efeito for adicionado
   * @param {Function} listener - Função de callback
   */
  onEffectAdded(listener) {
    this.onEffectAddedListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para quando um efeito for removido
   * @param {Function} listener - Função de callback
   */
  onEffectRemoved(listener) {
    this.onEffectRemovedListeners.push(listener);
  }
  
  /**
   * Adiciona um listener para quando um efeito for atualizado
   * @param {Function} listener - Função de callback
   */
  onEffectUpdated(listener) {
    this.onEffectUpdatedListeners.push(listener);
  }
  
  /**
   * Notifica sobre adição de efeito
   * @private
   */
  _notifyEffectAdded(effect) {
    for (const listener of this.onEffectAddedListeners) {
      try {
        listener(effect);
      } catch (error) {
        console.error('Erro em listener de efeito adicionado:', error);
      }
    }
  }
  
  /**
   * Notifica sobre remoção de efeito
   * @private
   */
  _notifyEffectRemoved(effect) {
    for (const listener of this.onEffectRemovedListeners) {
      try {
        listener(effect);
      } catch (error) {
        console.error('Erro em listener de efeito removido:', error);
      }
    }
  }
  
  /**
   * Notifica sobre atualização de efeito
   * @private
   */
  _notifyEffectUpdated(effect) {
    for (const listener of this.onEffectUpdatedListeners) {
      try {
        listener(effect);
      } catch (error) {
        console.error('Erro em listener de efeito atualizado:', error);
      }
    }
  }
  
  /**
   * Retorna dados serializáveis dos efeitos
   * @returns {Array} Lista de efeitos serializados
   */
  getSerializableData() {
    const result = [];
    
    for (const effect of this.effects.values()) {
      result.push(effect.getSerializableData());
    }
    
    return result;
  }
} 