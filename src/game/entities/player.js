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
    
    // Informações básicas do jogador
    this.name = data.name || 'Jogador';
    this.level = data.level || 1;
    this.class = data.class || 'warrior';
    
    // Estatísticas de combate
    this.hp = Number(data.hp) || 100;
    this.maxHp = Number(data.maxHp) || 100;
    this.mp = Number(data.mp) || 50;
    this.maxMp = Number(data.maxMp) || 50;
    
    // Propriedades de colisão
    this.collisionRadius = data.collisionRadius || 0.6; // Raio de colisão
    this.collisionEnabled = true; // Habilitar colisão
    
    // Controle de movimento
    this.isMoving = false;
    this.moveTarget = null;
    
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
      if (this.scene.entityManager) {
        const monsterModels = this.scene.entityManager.getMonsterModels();
        for (const model of monsterModels) {
          const id = this.scene.entityManager.getEntityIdByModel(model);
          console.log(`Monstro encontrado: ${id}`);
          if (id === targetId) {
            targetEntity = model;
            console.log(`Monstro encontrado pelo ID`);
            break;
          }
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
    const attackRangeWithTolerance = this.attackRange * 1.2; // Adicionar 20% de tolerância
    
    if (distance > attackRangeWithTolerance) {
      console.log(`Alvo ${targetId} fora de alcance (distância: ${distance.toFixed(2)}, alcance: ${attackRangeWithTolerance.toFixed(2)})`);
      return false;
    }
    
    console.log(`Alvo ${targetId} em alcance (distância: ${distance.toFixed(2)}, alcance: ${attackRangeWithTolerance.toFixed(2)})`);
    
    this.lastAttackTime = now;
    this.isAttacking = true;
    this.attackTarget = targetId;
    
    // Enviar ataque para o servidor, incluindo ID do atacante
    console.log(`Jogador ${this.id} atacando ${targetId}`);
    this.networkManager.emit('playerAttack', {
      targetId: targetId,
      attackerId: this.id
    });
    
    // IMPORTANTE: Aplicar dano localmente imediatamente, sem esperar resposta do servidor
    // Isso fará o monstro reagir antes mesmo da confirmação do servidor
    if (this.scene.entityManager) {
      const monster = this.scene.entityManager.monsters.get(targetId);
      if (monster) {
        console.log(`Aplicando dano local preliminar ao monstro ${targetId}`);
        // Dano estimado local (pode ser ajustado pelo servidor depois)
        const preliminaryDamage = 10;
        monster.takeDamage(preliminaryDamage, this.id);
      }
    }
    
    // Criar efeito visual
    if (this.scene.renderer) {
      this.scene.renderer.createAttackEffect(
        this.model.position.clone(),
        targetEntity.position.clone()
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
  
  /**
   * Aplica dano ao jogador
   * @param {number} damage - Quantidade de dano
   * @param {string} attackerId - ID do atacante
   * @returns {number} HP restante
   */
  takeDamage(damage, attackerId) {
    // Garantir que damage seja numérico
    damage = Number(damage) || 0;
    
    console.log(`[Player.takeDamage] Jogador ${this.id} recebeu ${damage} de dano de ${attackerId}`);
    
    // Verificar se estamos usando o sistema de combate
    if (this.combatStats) {
      console.log(`[Player.takeDamage] Utilizando sistema de combate para processar dano`);
      
      // Aplicar dano através do sistema de combate
      const damageResult = this.combatStats.applyDamage(damage, 'physical', attackerId);
      
      // Sincronizar dados internos com o sistema de combate
      this.hp = this.combatStats.hp;
      this.data.hp = this.hp;
      this.isDead = this.combatStats.isDead;
    } 
    // Fallback para o sistema antigo
    else {
      // Verificar se hp e maxHp existem, caso contrário, inicializá-los
      if (typeof this.hp !== 'number') this.hp = 100;
      if (typeof this.maxHp !== 'number') this.maxHp = 100;
      
      // Atualizar HP
      this.hp = Math.max(0, this.hp - damage);
      
      // Atualizar dados
      if (this.data) {
        this.data.hp = this.hp;
      }
      
      // Verificar se o jogador morreu
      if (this.hp <= 0 && !this.isDead) {
        this.isDead = true;
        if (typeof this.die === 'function') this.die();
      }
    }
    
    // Mostrar efeito visual de dano
    this.showDamageEffect(damage);
    
    // Atualizar UI se este for o jogador local
    if (window.game && window.game.entityManager && 
        window.game.entityManager.localPlayerId === this.id) {
      window.game.updatePlayerUI(this);
    }
    
    // Enviar evento para o servidor informando que o jogador foi danificado
    if (this.networkManager) {
      this.networkManager.emit('playerDamaged', {
        id: this.id,
        hp: this.hp,
        damage: damage,
        attackerId: attackerId
      });
    }
    
    console.log(`[Player.takeDamage] HP atualizado: ${this.hp}/${this.maxHp}`);
    return this.hp;
  }
  
  /**
   * Mostra um efeito visual de dano
   * @param {number} damage - Quantidade de dano
   */
  showDamageEffect(damage) {
    if (!this.model) return;
    
    // Salvar cor original
    const originalColor = this.model.material.color.clone();
    
    // Flash vermelho
    this.model.material.color.set(0xff0000);
    
    // Voltar à cor original
    setTimeout(() => {
      if (this.model && this.model.material) {
        this.model.material.color.copy(originalColor);
      }
    }, 200);
    
    // TODO: Mostrar número de dano flutuante
  }
  
  /**
   * Processa a morte do jogador
   */
  die() {
    if (!this.model) return;
    
    this.isDead = true;
    
    // Parar movimento
    this.stopMovement();
    
    // Desativar ataques
    this.stopAttack();
    
    // Efeito visual de morte (jogador cai para o lado)
    if (this.model) {
      this.model.rotation.z = Math.PI / 2;
    }
    
    console.log(`Jogador ${this.id} morreu!`);
    
    // Enviar evento de morte para o servidor
    if (this.networkManager) {
      this.networkManager.emit('playerDied', { playerId: this.id });
    }
    
    // Agendar respawn após alguns segundos
    setTimeout(() => {
      this.respawn();
    }, 5000);
  }
  
  /**
   * Respawna o jogador
   */
  respawn() {
    if (!this.model) return;
    
    // Resetar HP
    this.hp = this.data.maxHp || 100;
    this.data.hp = this.hp;
    this.isDead = false;
    
    // Restaurar rotação
    if (this.model) {
      this.model.rotation.z = 0;
    }
    
    // Voltar para posição inicial
    this.updatePosition({ x: 0, y: 0, z: 0 });
    
    console.log(`Jogador ${this.id} respawnou!`);
    
    // Enviar evento de respawn para o servidor
    if (this.networkManager) {
      this.networkManager.emit('playerRespawn', { playerId: this.id });
    }
  }
} 