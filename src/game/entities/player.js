import * as THREE from 'three';
import { Entity } from './entity';
import { CHARACTER_CLASSES, COMBAT_CONFIG, MOVEMENT_CONFIG, VISUAL_EFFECTS } from '../core/config';
import { debug } from '../utils/helpers';

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
    this.autoAttack = false;
    
    // Inicializar propriedades básicas
    this.name = data.name || `Jogador ${id}`;
    this.class = data.class || 'knight';
    this.level = Number(data.level) || 1;
    this.hp = Number(data.hp) || 150;           // HP inicial aumentado para 150
    this.maxHp = Number(data.maxHp) || 150;     // HP máximo aumentado para 150
    this.mp = Number(data.mp) || 50;
    this.maxMp = Number(data.maxMp) || 50;
    
    // Propriedades de colisão
    this.collisionRadius = data.collisionRadius || 0.6; // Raio de colisão
    this.collisionEnabled = true; // Habilitar colisão
    
    // Controle de movimento
    this.isMoving = false;
    this.moveTarget = null;
    this.moveDirection = null; // Nova propriedade para rastrear direção de movimento
    
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
    
    // Personalizar o modelo baseado no tipo de jogador
    if (isCurrentPlayer) {
      this.model.material.color.set(0x00ff00); // Verde para o jogador atual
    } else {
      this.model.material.color.set(0x0000ff); // Azul para outros jogadores
    }
    
    // CORREÇÃO: Posicionar na altura fixa padrão
    this.model.position.y = 0.5;
    
    // Criar tag de nome
    this.createNameTag(this.name || `Player ${this.id}`);
    
    return this.model;
  }
  
  /**
   * Atualiza o jogador a cada frame
   */
  update() {
    // Se o jogador estiver se movendo, atualizar o movimento
    if (this.isMoving) {
      // Verificar se temos um alvo de movimento
      if (this.moveTarget && this.model) {
        const currentPos = this.model.position.clone();
        const targetPos = this.moveTarget.clone();
        
        // Calcular distância e direção
        const distance = currentPos.distanceTo(targetPos);
        
        // Atualizar a direção do movimento para uso no sistema de colisão
        this.moveDirection = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
        
        // Se chegou ao destino
        if (distance < 0.1) {
          this.isMoving = false;
          this.moveTarget = null;
          this.moveDirection = null;
          
          // Emitir evento de parada, se necessário
          if (this.networkManager) {
            this.networkManager.emit('playerStopMoving', {
              id: this.id,
              position: {
                x: this.model.position.x,
                y: this.model.position.y,
                z: this.model.position.z
              }
            });
          }
          
          // Verificar se estava se movendo para atacar
          if (this.isAttacking && this.attackTarget) {
            this.attackEntity(this.attackTarget);
          }
          
          return true;
        }
        
        // Mover em direção ao alvo usando a lógica da classe pai
        // Garantir que a targetPosition esteja correta
        this.targetPosition = targetPos;
        
        // Atualizar movimento usando a função da classe pai
        const reachedDestination = this.updateMovement(this.moveSpeed);
        
        // CORREÇÃO: Forçar altura fixa para evitar "voar" ou "afundar"
        this.model.position.y = 0.5;
        
        // Se o jogador se moveu, enviar atualização para o servidor
        if (this.networkManager) {
          this.networkManager.emit('playerMove', {
            id: this.id,
            position: {
              x: this.model.position.x,
              y: this.model.position.y,
              z: this.model.position.z
            }
          });
        }
        
        return reachedDestination;
      }
    } else {
      // Se não está se movendo, limpar a direção
      this.moveDirection = null;
      
      // CORREÇÃO: Garantir altura fixa mesmo quando parado
      if (this.model && this.model.position.y !== 0.5) {
        this.model.position.y = 0.5;
      }
    }
    
    return false;
  }
  
  /**
   * Move o jogador para uma posição específica
   * @param {THREE.Vector3|Object} position - Posição de destino
   * @param {Function} callback - Função a ser chamada ao chegar ao destino
   * @param {boolean} ignoreLimits - Se deve ignorar os limites do mapa
   */
  moveToPosition(position, callback = null, ignoreLimits = false) {
    // Converter posição se necessário
    let targetPosition = position;
    if (!(position instanceof THREE.Vector3)) {
      targetPosition = new THREE.Vector3(position.x, position.y, position.z);
    }
    
    // Armazenar o alvo de movimento
    this.moveTarget = targetPosition.clone();
    
    // Configurar estado
    this.isMoving = true;
    
    // Chamar o método da classe pai
    super.moveToPosition(targetPosition, callback, ignoreLimits);
    
    // Atualizar dados do jogador
    if (this.data) {
      this.data.position = {
        x: this.model.position.x,
        y: this.model.position.y,
        z: this.model.position.z
      };
    }
  }
  
  /**
   * Ataca uma entidade pelo ID
   * @param {string} targetId - ID da entidade alvo
   * @returns {boolean} Indica se o ataque foi bem-sucedido
   */
  attackEntity(targetId) {
    // Verificações básicas
    if (!this.model || !this.networkManager || !targetId) {
      console.error("[Player.attackEntity] FALHA: modelo ou network inválidos");
      return false;
    }
    
    debug('combat', `Jogador ${this.id} atacando monstro ${targetId}`);
    
    // Verificar cooldown
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldownTime) {
      debug('combat', 'Ataque em cooldown, ignorando');
      return false;
    }
    
    // SOLUÇÃO: Buscar monstro DIRETAMENTE do window.game
    let monster = null;
    
    // Método 1: Através da variável global (mais confiável)
    if (window.game && window.game.entityManager) {
      monster = window.game.entityManager.monsters.get(targetId);
      debug('combat', 'Buscando monstro via window.game', monster ? "ENCONTRADO" : "NÃO ENCONTRADO");
    }
    
    // Método 2: Através da referência na cena (backup)
    if (!monster && this.scene && this.scene.entityManager) {
      monster = this.scene.entityManager.monsters.get(targetId);
      debug('combat', 'Buscando monstro via this.scene', monster ? "ENCONTRADO" : "NÃO ENCONTRADO");
    }
    
    // Se o monstro não for encontrado, abortar
    if (!monster) {
      console.error(`[Player.attackEntity] FALHA: monstro ${targetId} não encontrado`);
      return false;
    }
    
    // Verificar distância
    if (this.model && monster.model) {
      const distance = this.model.position.distanceTo(monster.model.position);
      debug('combat', `Distância até o monstro: ${distance.toFixed(2)} (limite: ${this.attackRange})`);
      
      if (distance > this.attackRange) {
        console.log(`[Player.attackEntity] Monstro fora de alcance: ${distance.toFixed(1)} > ${this.attackRange}`);
        return false;
      }
    }
    
    // Calcular direção para o monstro e girar para ele
    const direction = new THREE.Vector3()
      .subVectors(monster.model.position, this.model.position)
      .normalize();
    
    if (direction.length() > 0.001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.model.rotation.y = targetRotation;
    }
    
    // Criar efeito visual de ataque
    if (this.scene.renderer) {
      this.scene.renderer.createAttackEffect(
        this.model.position.clone(),
        monster.model.position.clone(),
        0xff0000,
        600
      );
    }
    
    // CRUCIAL - Passo 1: Enviar ataque para o servidor
    try {
      debug('combat', `Enviando evento playerAttack para o servidor (alvo: ${targetId})`);
      
      // Calcular dano com base nos atributos do jogador
      const baseDamage = 10; // Dano base
      const variationFactor = 0.3; // 30% de variação
      let damage = Math.floor(baseDamage * (1 - variationFactor + Math.random() * variationFactor * 2));
      
      // Verificar se o modo One Shot Kill está ativado
      if (window.game && window.game.DEBUG_CONFIG && window.game.DEBUG_CONFIG.oneShotKill) {
        damage = monster.hp || 100; // Definir dano igual ao HP do monstro
        debug('combat', 'Modo ONE SHOT KILL ativado! Dano ajustado para: ' + damage);
      }
      
      this.networkManager.emit('playerAttack', {
        targetId: targetId,
        attackerId: this.id,
        damage: damage
      });
    } catch (error) {
      console.error(`[Player.attackEntity] Erro ao enviar ataque para o servidor:`, error);
    }
    
    // CRUCIAL - Passo 2: Aplicar dano local para feedback imediato
    try {
      // Verificar se o monstro existe e tem o método takeDamage
      if (monster && typeof monster.takeDamage === 'function') {
        // Calcular dano (mesmo cálculo que enviamos para o servidor para consistência)
        const baseDamage = 10; // Dano base
        const variationFactor = 0.3; // 30% de variação
        let damage = Math.floor(baseDamage * (1 - variationFactor + Math.random() * variationFactor * 2));
        
        // Verificar se o modo One Shot Kill está ativado
        if (window.game && window.game.DEBUG_CONFIG && window.game.DEBUG_CONFIG.oneShotKill) {
          damage = monster.hp || 100; // Definir dano igual ao HP do monstro
          debug('combat', 'Modo ONE SHOT KILL ativado! Dano ajustado para: ' + damage);
        }
        
        debug('combat', `Aplicando ${damage} de dano ao monstro ${targetId}`);
        
        // Atualizar tempo de ataque ANTES de aplicar dano (evita múltiplos ataques)
        this.lastAttackTime = now;
        this.isAttacking = true;
        this.attackTarget = targetId;
        
        // Aplicar dano - FORÇAR EXECUÇÃO SEM ERRO
        try {
          monster.takeDamage(damage, this.id);
          debug('combat', 'Dano aplicado com sucesso: ' + damage);
        } catch (damageError) {
          console.error('[Player.attackEntity] Erro ao aplicar dano:', damageError);
        }
        
        // Forçar a atualização da UI do monstro
        if (monster.updateNameDisplay && typeof monster.updateNameDisplay === 'function') {
          setTimeout(() => monster.updateNameDisplay(), 50);
        }
      } else {
        console.error(`[Player.attackEntity] Monstro não possui método takeDamage:`, monster);
      }
    } catch (err) {
      console.error(`[Player.attackEntity] Erro ao aplicar dano:`, err);
    }
    
    // CRUCIAL - Passo 3: Forçar o monstro a reagir
    try {
      if (monster && monster.ai && typeof monster.ai.setAggroTarget === 'function') {
        debug('combat', `Definindo alvo de agressividade do monstro para ${this.id}`);
        monster.ai.setAggroTarget(this.id);
      } else if (monster && !monster.ai) {
        console.warn(`[Player.attackEntity] AVISO: Monstro ${targetId} não possui IA`);
      }
    } catch (err) {
      console.error(`[Player.attackEntity] Erro ao definir agressividade:`, err);
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
   * @param {string} attackerId - ID do atacante (monstro ou outro jogador)
   * @returns {number} HP restante
   */
  takeDamage(damage, attackerId) {
    // Garantir que damage seja numérico
    damage = Number(damage) || 0;
    
    console.log(`[Player] 🔥 ${this.id} recebeu ${damage} de dano de ${attackerId}`);
    
    // Se estiver morto, não fazer nada
    if (this.isDead) {
      return 0;
    }
    
    // Atualizar HP diretamente
    const oldHp = this.hp;
    this.hp = Math.max(0, this.hp - damage);
    
    // Verificar se o dano foi aplicado corretamente
    if (oldHp === this.hp) {
      console.error(`[Player.takeDamage] FALHA AO APLICAR DANO: HP não mudou! ${oldHp} -> ${this.hp}`);
    } else {
      console.log(`[Player.takeDamage] HP atualizado: ${oldHp} -> ${this.hp}`);
    }
    
    // Sincronizar com dados
    if (this.data) {
      this.data.hp = this.hp;
    }
    
    // Atualizar interface do jogador se for o jogador local
    if (this.id === window.game?.entityManager?.localPlayerId) {
      if (window.game && window.game.updatePlayerUI) {
        window.game.updatePlayerUI(this);
      }
    }
    
    // Mostrar efeito visual de dano (MUITO visível)
    this.showDamageEffect(damage);
    
    // Verificar se morreu
    if (this.hp <= 0) {
      console.log(`[Player] ☠️ ${this.id} morreu após receber ${damage} de dano`);
      this.isDead = true;
      this.die();
      return 0;
    }
    
    // Notificar servidor sobre o dano
    if (this.networkManager) {
      this.networkManager.emit('playerDamaged', {
        id: this.id,
        attackerId: attackerId,
        damage: damage,
        hp: this.hp
      });
    }
    
    return this.hp;
  }
  
  /**
   * Mostra um efeito visual de dano
   * @param {number} damage - Quantidade de dano
   */
  showDamageEffect(damage) {
    if (!this.model) return;
    
    console.log(`[Player] Mostrando efeito de dano: ${damage}`);
    
    // 1. Flash vermelho intenso
    const originalColor = this.model.material.color.clone();
    this.model.material.color.set(0xff0000); // Vermelho brilhante
    this.model.material.emissive = new THREE.Color(0xff0000);
    
    // Voltar à cor original
    setTimeout(() => {
      if (this.model && this.model.material) {
        this.model.material.color.copy(originalColor);
        this.model.material.emissive = new THREE.Color(0x000000);
      }
    }, 300);
    
    // 2. Criar texto flutuante com o valor do dano
    if (this.scene && this.scene.uiManager) {
      this.scene.uiManager.showDamageNumber(this, damage, 'physical');
    } else if (window.game && window.game.ui) {
      window.game.ui.showDamageNumber(this, damage, 'physical');
    }
    
    // 3. Fazer o modelo "pular" brevemente
    const originalY = this.model.position.y;
    const jumpHeight = 0.2;
    
    // Subir
    this.model.position.y += jumpHeight;
    
    // Voltar à posição original
    setTimeout(() => {
      if (this.model) {
        // Usar animação suave para descer
        const steps = 5;
        const stepSize = jumpHeight / steps;
        
        const animateDown = (step) => {
          if (step < steps && this.model) {
            this.model.position.y -= stepSize;
            setTimeout(() => animateDown(step + 1), 20);
          } else if (this.model) {
            // Garantir posição final correta
            this.model.position.y = Math.max(1.0, originalY);
          }
        };
        
        animateDown(0);
      }
    }, 150);
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
    if (!this.isDead) return;
    
    console.log(`[Player] ${this.id} ressuscitando...`);
    
    // Restaurar HP para o valor máximo
    this.hp = this.maxHp || 150;
    
    // Atualizar estado do jogador
    this.isDead = false;
    
    // Reativar física e colisão
    if (this.model) {
      this.model.visible = true;
      
      // CORREÇÃO: Garantir altura Y fixa ao respawnar
      this.model.position.set(0, 0.5, 0); // Altura fixa Y=0.5
    }
    
    // Atualizar visualmente
    this.updateNameDisplay();
    
    // Informar o servidor
    if (this.networkManager) {
      this.networkManager.emit('playerRespawn', { id: this.id });
    }
    
    // Emitir evento local
    if (window.game && window.game.eventSystem) {
      window.game.eventSystem.emit('playerRespawned', { id: this.id });
    }
    
    console.log(`[Player] ${this.id} ressuscitado com HP: ${this.hp}`);
  }
} 