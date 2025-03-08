import * as THREE from 'three';
import { Entity } from './entity';
import { CHARACTER_CLASSES, COMBAT_CONFIG, MOVEMENT_CONFIG, VISUAL_EFFECTS } from '../core/config';

/**
 * Classe que representa um jogador no jogo
 */
export class Player extends Entity {
  constructor(id, data, scene, networkManager, renderer) {
    super(id, data, scene);
    
    this.networkManager = networkManager;
    this.renderer = renderer;
    this.isAttacking = false;
    this.attackTarget = null;
    this.lastAttackTime = 0;
    this.attackCooldownTime = COMBAT_CONFIG.defaultAttackCooldown;
    this.attackRange = COMBAT_CONFIG.defaultAttackRange;
    this.moveSpeed = MOVEMENT_CONFIG.defaultMoveSpeed;
    
    // Carregar propriedades da classe do jogador
    this.loadClassProperties();
  }
  
  /**
   * Carrega as propriedades baseadas na classe do jogador
   */
  loadClassProperties() {
    // Definir classe padrão como cavaleiro se não for especificada
    const playerClass = this.data.class || 'knight';
    const classProps = CHARACTER_CLASSES[playerClass] || CHARACTER_CLASSES.knight;
    
    this.attackRange = classProps.attackRange;
    this.moveSpeed = classProps.moveSpeed;
    this.attackCooldownTime = COMBAT_CONFIG.defaultAttackCooldown / classProps.attackSpeed;
    
    console.log(`Jogador ${this.id} é um ${classProps.name} com alcance de ataque de ${this.attackRange}`);
  }
  
  /**
   * Cria o modelo 3D do jogador
   * @param {boolean} isCurrentPlayer - Indica se é o jogador atual
   */
  createPlayerModel(isCurrentPlayer = false) {
    // Determinar a cor baseada na classe
    const playerClass = this.data.class || 'knight';
    const classInfo = CHARACTER_CLASSES[playerClass] || CHARACTER_CLASSES.knight;
    const color = isCurrentPlayer ? classInfo.color : 0x0000ff;
    
    // Criar geometria e material
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color });
    
    // Criar modelo usando o método da classe pai
    this.createModel(geometry, material);
    
    // Adicionar nome
    const displayName = this.data.name || `Player ${this.id}`;
    this.createNameTag(displayName);
    
    return this.model;
  }
  
  /**
   * Atualiza o movimento do jogador e sincroniza com o servidor
   */
  update() {
    // Atualizar movimento usando o método da classe pai
    const reachedDestination = this.updateMovement(this.moveSpeed);
    
    // Se o jogador se moveu, enviar atualização para o servidor
    if (this.isMoving && this.networkManager) {
      this.networkManager.emit('playerMove', this.data.position);
    }
    
    // Se chegou ao destino e estava se movendo para atacar, iniciar ataque
    if (reachedDestination && this.isAttacking && this.attackTarget) {
      this.attackEntity(this.attackTarget);
    }
    
    return reachedDestination;
  }
  
  /**
   * Ataca uma entidade
   * @param {string} targetId - ID da entidade a ser atacada
   * @returns {boolean} - Se o ataque foi bem-sucedido
   */
  attackEntity(targetId) {
    if (!this.model || !this.networkManager) {
      console.log("Ataque falhou: player não tem modelo ou networkManager");
      return false;
    }
    
    if (!targetId) {
      console.log("Ataque falhou: targetId está vazio");
      return false;
    }
    
    // Verificar cooldown
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldownTime) {
      // Silenciosamente falhar sem log para evitar spam
      return false;
    }
    
    // Encontrar a entidade alvo - temos várias formas de tentar encontrar
    let targetEntity = null;
    
    // Método 1: Buscar nos filhos da cena com userData
    for (const model of this.scene.children) {
      if (model.userData && model.userData.entityId === targetId) {
        targetEntity = model;
        break;
      }
    }
    
    // Método 2: Tentar usar o data-entity-id como seletor DOM (fallback)
    if (!targetEntity) {
      // Tentar com o entityManager
      const monsterModels = this.scene.children.filter(child => 
        child.userData && child.userData.entityId && child.userData.entityId.startsWith('monster')
      );
      
      console.log(`Buscando monstro com ID ${targetId}. Monstros disponíveis:`, 
        monsterModels.map(m => m.userData.entityId)
      );
      
      for (const model of monsterModels) {
        console.log(`Verificando modelo: ID=${model.userData.entityId}`);
        if (model.userData.entityId === targetId) {
          targetEntity = model;
          console.log(`Monstro encontrado pelo ID`);
          break;
        }
      }
    }
    
    if (!targetEntity) {
      console.log(`Alvo ${targetId} não encontrado para ataque após tentativas múltiplas`);
      return false;
    }
    
    // Verificar se o monstro está morto
    if (targetEntity.userData && targetEntity.userData.isDead) {
      console.log(`Ataque falhou: monstro ${targetId} está morto`);
      return false;
    }
    
    // Verificar distância
    const distance = this.model.position.distanceTo(targetEntity.position);
    if (distance > this.attackRange) {
      console.log(`Alvo ${targetId} fora de alcance (distância: ${distance.toFixed(2)}, alcance: ${this.attackRange.toFixed(2)})`);
      return false;
    }
    
    this.lastAttackTime = now;
    this.isAttacking = true;
    this.attackTarget = targetId;
    
    // Enviar ataque para o servidor
    console.log(`Jogador ${this.id} atacando ${targetId}`);
    this.networkManager.emit('playerAttack', targetId);
    
    // Criar efeito visual
    if (this.renderer) {
      const attackEffect = this.renderer.createAttackEffect(
        this.model.position.clone(), 
        targetEntity.position.clone(),
        VISUAL_EFFECTS.attackColor,
        COMBAT_CONFIG.attackEffectDuration
      );
    }
    
    return true;
  }
  
  /**
   * Interrompe o ataque atual
   */
  stopAttack() {
    this.isAttacking = false;
    this.attackTarget = null;
  }
} 