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
   * Cria ou atualiza um monstro
   * @param {string} monsterId - ID do monstro
   * @param {Object} monsterData - Dados do monstro
   * @returns {Monster} O monstro criado ou atualizado
   */
  createOrUpdateMonster(monsterId, monsterData) {
    // Verificar se o monstro já existe
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      
      // Atualizar posição se necessário
      if (monsterData.position) {
        monster.updatePosition(monsterData.position);
      }
      
      // Atualizar HP se necessário
      if (monsterData.hp !== undefined) {
        monster.hp = monsterData.hp;
        monster.data.hp = monsterData.hp;
      }
      
      return monster;
    }
    
    // Criar novo monstro
    const monster = new Monster(monsterId, monsterData, this.scene);
    monster.createMonsterModel();
    
    // Adicionar à coleção
    this.monsters.set(monsterId, monster);
    
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
   * Aplica dano a um monstro
   * @param {string} monsterId - ID do monstro
   * @param {number} damage - Quantidade de dano
   * @returns {number} HP restante
   */
  damageMonster(monsterId, damage) {
    if (this.monsters.has(monsterId)) {
      const monster = this.monsters.get(monsterId);
      return monster.takeDamage(damage);
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
   * Ataca um monstro (para o jogador local)
   * @param {string} monsterId - ID do monstro
   */
  attackMonster(monsterId) {
    if (!this.localPlayerId || !this.players.has(this.localPlayerId)) return;
    
    const player = this.players.get(this.localPlayerId);
    player.attackEntity(monsterId);
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
} 