import { Player } from './player';
import { Monster } from './monster';

/**
 * Classe para gerenciar todas as entidades do jogo
 */
export class EntityManager {
  constructor(scene, networkManager, renderer) {
    this.scene = scene;
    this.networkManager = networkManager;
    this.renderer = renderer;
    
    this.players = new Map();
    this.monsters = new Map();
    this.localPlayerId = null;
    
    // Referência ao sistema de combate (será definido após inicialização)
    this.combatSystem = null;
  }
  
  /**
   * Define a referência ao sistema de combate
   * @param {Object} combatSystem - Sistema de combate
   */
  setCombatSystem(combatSystem) {
    this.combatSystem = combatSystem;
    console.log('[EntityManager] Sistema de combate registrado');
  }
  
  /**
   * Define o ID do jogador local
   * @param {string} playerId - ID do jogador local
   */
  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }
  
  /**
   * Atualiza todas as entidades do jogo
   */
  updateEntities() {
    // Atualizar jogadores
    this.players.forEach(player => {
      player.update();
    });
    
    // Atualizar monstros
    this.monsters.forEach(monster => {
      monster.update();
    });
  }
  
  /**
   * Cria ou atualiza um jogador
   * @param {string} playerId - ID do jogador
   * @param {Object} playerData - Dados do jogador
   * @returns {Player} O jogador criado ou atualizado
   */
  createOrUpdatePlayer(playerId, playerData) {
    // Verificar se o jogador já existe
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      
      // Atualizar posição se necessário
      if (playerData.position) {
        player.updatePosition(playerData.position);
      }
      
      return player;
    }
    
    // Criar novo jogador
    const isCurrentPlayer = playerId === this.localPlayerId;
    const player = new Player(playerId, playerData, this.scene, isCurrentPlayer ? this.networkManager : null, this.renderer);
    player.createPlayerModel(isCurrentPlayer);
    
    // Adicionar à coleção
    this.players.set(playerId, player);
    
    return player;
  }
  
  /**
   * Cria um jogador local (o jogador do cliente)
   * @param {Object} playerData - Dados do jogador
   * @returns {Player} O jogador criado
   */
  createLocalPlayer(playerData) {
    const playerId = playerData.id;
    
    // Verificar se já existe
    if (this.players.has(playerId)) {
      return this.players.get(playerId);
    }
    
    // Criar o jogador
    const player = this.createOrUpdatePlayer(playerId, playerData);
    
    // Definir como jogador local
    this.setLocalPlayerId(playerId);
    
    // Registrá-lo no sistema de combate se disponível
    if (this.combatSystem) {
      this.combatSystem.setupEntity(player, {
        level: playerData.level || 1,
        stats: {
          maxHp: playerData.maxHp || 100,
          maxMp: playerData.maxMp || 50,
          attack: playerData.attack || 10,
          defense: playerData.defense || 5
        }
      });
    }
    
    return player;
  }
  
  /**
   * Cria ou atualiza um monstro
   * @param {string} monsterId - ID do monstro
   * @param {Object} monsterData - Dados do monstro
   * @returns {Monster} O monstro criado ou atualizado
   */
  createOrUpdateMonster(monsterId, monsterData) {
    // Verificar se o monstro já existe
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      monster.updateData(monsterData);
      return monster;
    }
    
    // Criar um novo monstro - usar a assinatura original do construtor
    const monster = new Monster(monsterId, monsterData, this.scene);
    
    // Explicitamente criar o modelo 3D do monstro
    monster.createMonsterModel();
    
    // Adicionar à coleção
    this.monsters.set(monsterId, monster);
    
    // Configurar acesso ao NetworkManager
    monster.scene.networkManager = this.networkManager;
    
    // Ativar a IA com acesso ao EntityManager
    if (monster.ai) {
      monster.ai.activate(this);
    }
    
    // Registrá-lo no sistema de combate se disponível
    if (this.combatSystem) {
      // Calcular atributos com base no tipo e nível do monstro
      const level = monsterData.level || 1;
      const typeConfig = monster.isAggressive 
        ? { attack: monster.attackDamage * 1.2, defense: 5 * level } 
        : { attack: monster.attackDamage, defense: 3 * level };
      
      this.combatSystem.setupEntity(monster, {
        level: level,
        stats: {
          maxHp: monster.maxHp,
          maxMp: 20 * level,
          attack: typeConfig.attack,
          defense: typeConfig.defense
        }
      });
    }
    
    console.log(`[EntityManager] Monstro criado: ${monsterId}, tipo: ${monster.type}`);
    
    return monster;
  }
  
  /**
   * Remove um jogador
   * @param {string} playerId - ID do jogador
   */
  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      player.destroy();
      this.players.delete(playerId);
    }
  }
  
  /**
   * Remove um monstro
   * @param {string} monsterId - ID do monstro
   */
  removeMonster(monsterId) {
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      monster.destroy();
      this.monsters.delete(monsterId);
    }
  }
  
  /**
   * Obtém uma entidade pelo ID (jogador ou monstro)
   * @param {string} entityId - ID da entidade
   * @returns {Object} A entidade se encontrada, null caso contrário
   */
  getEntityById(entityId) {
    if (this.players.has(entityId)) {
      return this.players.get(entityId);
    }
    
    if (this.monsters.has(entityId)) {
      return this.monsters.get(entityId);
    }
    
    return null;
  }
  
  /**
   * Aplica dano a um monstro
   * @param {string} monsterId - ID do monstro
   * @param {number} damage - Quantidade de dano
   * @param {string} attackerId - ID do atacante
   * @returns {number} HP restante
   */
  damageMonster(monsterId, damage, attackerId = null) {
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      
      // Se temos o sistema de combate e atacante, tentar usar o sistema de combate
      if (this.combatSystem && attackerId) {
        const attacker = this.getEntityById(attackerId);
        if (attacker && monster && monster.combatStats) {
          console.log(`[EntityManager] Processando dano via sistema de combate: ${attackerId} → ${monsterId}`);
          const result = this.combatSystem.processAttack(attacker, monster);
          return monster.hp;
        }
      }
      
      // Fallback para o método direto
      return monster.takeDamage(damage, attackerId);
    }
    return 0;
  }
  
  /**
   * Mata um monstro
   * @param {string} monsterId - ID do monstro
   */
  killMonster(monsterId) {
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      monster.die();
    }
  }
  
  /**
   * Respawna um monstro
   * @param {string} monsterId - ID do monstro
   * @param {Object} monsterData - Dados atualizados do monstro
   */
  respawnMonster(monsterId, monsterData) {
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      
      // Atualizar dados se fornecidos
      if (monsterData) {
        Object.assign(monster.data, monsterData);
      }
      
      monster.respawn();
    }
  }
  
  /**
   * Ataca um monstro com o jogador local
   * @param {string} monsterId - ID do monstro a ser atacado
   * @returns {boolean} Se o ataque foi bem-sucedido
   */
  attackMonster(monsterId) {
    // Verificar se o jogador local existe
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      console.warn('Não foi possível atacar: jogador local não encontrado');
      return false;
    }
    
    // Verificar se o monstro existe
    const monster = this.monsters.get(monsterId);
    if (!monster) {
      console.warn(`Não foi possível atacar: monstro ${monsterId} não encontrado`);
      return false;
    }
    
    // Atacar o monstro - enviando o ID do jogador para o monstro ficar agressivo
    return localPlayer.attackEntity(monsterId);
  }
  
  /**
   * Obtém o jogador local
   * @returns {Player|null} O jogador local ou null se não existir
   */
  getLocalPlayer() {
    if (!this.localPlayerId) return null;
    return this.players.get(this.localPlayerId) || null;
  }
  
  /**
   * Obtém uma lista de todos os modelos de monstros
   * @returns {Array} Lista de modelos de monstros
   */
  getMonsterModels() {
    return Array.from(this.monsters.values())
      .filter(monster => monster.model && monster.model.visible)
      .map(monster => monster.model);
  }
  
  /**
   * Obtém o ID de uma entidade pelo seu modelo
   * @param {THREE.Mesh} model - Modelo 3D
   * @returns {string|null} ID da entidade ou null se não for encontrada
   */
  getEntityIdByModel(model) {
    // Verificar nas propriedades do usuário
    if (model.userData && model.userData.entityId) {
      return model.userData.entityId;
    }
    
    // Buscar em jogadores
    for (const [id, player] of this.players.entries()) {
      if (player.model === model) {
        return id;
      }
    }
    
    // Buscar em monstros
    for (const [id, monster] of this.monsters.entries()) {
      if (monster.model === model) {
        return id;
      }
    }
    
    return null;
  }
  
  /**
   * Limpa todas as entidades
   */
  clear() {
    // Limpar jogadores
    this.players.forEach(player => {
      player.destroy();
    });
    this.players.clear();
    
    // Limpar monstros
    this.monsters.forEach(monster => {
      monster.destroy();
    });
    this.monsters.clear();
    
    this.localPlayerId = null;
  }
  
  /**
   * Aplica dano a um jogador
   * @param {string} playerId - ID do jogador
   * @param {number} damage - Quantidade de dano
   * @param {string} attackerId - ID do atacante
   * @returns {number} HP restante
   */
  damagePlayer(playerId, damage, attackerId = null) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      
      // Se temos o sistema de combate e atacante, tentar usar o sistema de combate
      if (this.combatSystem && attackerId) {
        const attacker = this.getEntityById(attackerId);
        if (attacker && player && player.combatStats) {
          console.log(`[EntityManager] Processando dano via sistema de combate: ${attackerId} → ${playerId}`);
          const result = this.combatSystem.processAttack(attacker, player);
          return player.hp;
        }
      }
      
      // Fallback para o método direto
      return player.takeDamage(damage, attackerId);
    }
    return 0;
  }
} 