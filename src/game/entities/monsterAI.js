import * as THREE from 'three';
import { MONSTER_AI_CONFIG } from '../core/config';

// Garantir que THREE esteja disponível globalmente para este módulo
const Vector3 = THREE.Vector3;

/**
 * Classe responsável pela IA dos monstros
 */
export class MonsterAI {
  /**
   * Inicializa a IA do monstro
   * @param {Monster} monster - Referência ao monstro
   */
  constructor(monster) {
    this.monster = monster;
    this.wanderRadius = MONSTER_AI_CONFIG.wanderRadius;
    this.minWanderTime = MONSTER_AI_CONFIG.minWanderTime;
    this.maxWanderTime = MONSTER_AI_CONFIG.maxWanderTime;
    this.attackInterval = monster.attackInterval || MONSTER_AI_CONFIG.attackInterval;
    this.checkPlayerInterval = MONSTER_AI_CONFIG.checkPlayerInterval;
    this.aggroDuration = MONSTER_AI_CONFIG.aggroDuration;
    
    this.spawnPosition = monster.model ? new Vector3(
      monster.model.position.x,
      monster.model.position.y,
      monster.model.position.z
    ) : new Vector3(0, 0, 0);
    
    // Estado da IA
    this.isActive = false;
    this.isAggressive = monster.isAggressive || false;
    this.aggroRadius = monster.aggroRadius || MONSTER_AI_CONFIG.aggroRadius;
    
    // Timers e callbacks
    this.wanderTimeout = null;
    this.aggroTimeout = null;
    this.checkPlayersInterval = null;
    this.attackInterval = null;
    
    // Estado de agressividade
    this.state = 'idle'; // idle, wander, aggro, attack
    this.aggroTarget = null;
    this.lastWanderTime = 0;
    this.lastAttackTime = 0;
    this.aggroLostTime = 0;
    
    this.entityManager = null; // Será definido quando ativado
  }
  
  /**
   * Ativa a IA do monstro
   * @param {EntityManager} entityManager - Gerenciador de entidades
   */
  activate(entityManager) {
    if (this.isActive) return;
    
    console.log(`[MonsterAI.activate] Ativando IA para monstro ${this.monster.id}`);
    
    this.isActive = true;
    
    // Armazenar referência ao EntityManager
    if (entityManager) {
      this.entityManager = entityManager;
      console.log(`[MonsterAI.activate] EntityManager configurado para monstro ${this.monster.id}`);
    } else if (this.monster.scene && this.monster.scene.entityManager) {
      this.entityManager = this.monster.scene.entityManager;
      console.log(`[MonsterAI.activate] EntityManager obtido da cena para monstro ${this.monster.id}`);
    } else {
      console.warn(`[MonsterAI.activate] EntityManager não disponível para monstro ${this.monster.id}`);
    }
    
    // Salvar referência ao gerenciador de entidades na instância do monstro também
    if (this.entityManager && this.monster) {
      this.monster.entityManager = this.entityManager;
    }
    
    // Iniciar comportamentos
    this.startCheckingForPlayers();
    
    // Iniciar com comportamento de perambulação se não for agressivo
    if (!this.monster.isAggressive) {
      this.scheduleNextWander();
    }
  }
  
  /**
   * Desativa a IA do monstro
   */
  deactivate() {
    this.isActive = false;
    
    // Limpar todos os timers
    this.clearAllTimers();
    
    // Resetar estado
    this.aggroTarget = null;
    this.state = 'idle';
    
    console.log(`IA do monstro ${this.monster.id} desativada`);
  }
  
  /**
   * Limpa todos os timers da IA
   */
  clearAllTimers() {
    if (this.wanderTimeout) {
      clearTimeout(this.wanderTimeout);
      this.wanderTimeout = null;
    }
    
    if (this.aggroTimeout) {
      clearTimeout(this.aggroTimeout);
      this.aggroTimeout = null;
    }
    
    if (this.checkPlayersInterval) {
      clearInterval(this.checkPlayersInterval);
      this.checkPlayersInterval = null;
    }
    
    if (this.attackInterval) {
      clearInterval(this.attackInterval);
      this.attackInterval = null;
    }
  }
  
  /**
   * Define o estado atual da IA
   * @param {string} state - Novo estado ('idle', 'wander', 'aggro', 'attack')
   */
  setState(state) {
    const oldState = this.state;
    this.state = state;
    
    if (oldState !== state) {
      console.log(`Monstro ${this.monster.id} mudou estado: ${oldState} -> ${state}`);
      
      // Ações ao mudar para cada estado
      if (state === 'idle') {
        // Nada especial a fazer no estado idle
      } else if (state === 'wander') {
        // Já em perambulação, não precisa fazer nada especial
      } else if (state === 'aggro') {
        // Interromper perambulação para focar na perseguição
        this.stopWandering();
      } else if (state === 'attack') {
        // Parar movimento e começar a atacar
        this.monster.stopMovement();
        this.startAttacking();
      }
    }
  }
  
  /**
   * Agenda o próximo movimento aleatório
   */
  scheduleNextWander() {
    if (!this.isActive || this.monster.isDead || this.state === 'aggro' || this.state === 'attack') return;
    
    // Limpar timeout existente
    if (this.wanderTimeout) {
      clearTimeout(this.wanderTimeout);
    }
    
    // Tempo aleatório para o próximo movimento
    const nextWanderTime = Math.random() * (this.maxWanderTime - this.minWanderTime) + this.minWanderTime;
    
    // Agendar próximo movimento
    this.wanderTimeout = setTimeout(() => {
      if (this.state !== 'aggro' && this.state !== 'attack') {
        this.setState('wander');
        this.wander();
      }
      this.scheduleNextWander();
    }, nextWanderTime);
  }
  
  /**
   * Para o comportamento de perambulação
   */
  stopWandering() {
    if (this.wanderTimeout) {
      clearTimeout(this.wanderTimeout);
      this.wanderTimeout = null;
    }
  }
  
  /**
   * Inicia verificação periódica de jogadores próximos
   */
  startCheckingForPlayers() {
    if (this.checkPlayersInterval) {
      clearInterval(this.checkPlayersInterval);
    }
    
    this.checkPlayersInterval = setInterval(() => {
      this.checkForPlayersInRange();
    }, this.checkPlayerInterval);
  }
  
  /**
   * Verifica se há jogadores dentro do raio de agressividade
   */
  checkForPlayersInRange() {
    if (!this.isActive || this.monster.isDead || !this.entityManager || !this.monster.model) return;
    
    // Se já está perseguindo um alvo, continuar com ele
    if (this.aggroTarget && (this.state === 'aggro' || this.state === 'attack')) {
      return;
    }
    
    // Verificar apenas se for um monstro agressivo e não estiver já atacando
    if (!this.isAggressive) return;
    
    const monsterPosition = this.monster.model.position;
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    // Verificar todos os jogadores
    this.entityManager.players.forEach(player => {
      if (player.model && !player.isDead) {
        const distance = monsterPosition.distanceTo(player.model.position);
        
        // Se o jogador está dentro do raio de agressividade
        if (distance <= this.aggroRadius && distance < closestDistance) {
          closestPlayer = player;
          closestDistance = distance;
        }
      }
    });
    
    // Se encontrou um jogador no raio, persegui-lo
    if (closestPlayer) {
      this.setAggroTarget(closestPlayer.id);
    }
  }
  
  /**
   * Define um jogador como alvo de agressividade
   * @param {string} playerId - ID do jogador alvo
   */
  setAggroTarget(playerId) {
    try {
      // Verificar parâmetros
      if (!playerId) {
        console.error("[MonsterAI] Tentativa de definir alvo sem ID do jogador");
        return;
      }
      
      console.log(`⚔️🎯 [MonsterAI] ${this.monster?.id || 'Desconhecido'} definindo alvo: ${playerId}`);
      
      // Verificar estado do monstro
      if (!this.monster || this.monster.isDead) {
        console.log(`[MonsterAI] Monstro morto ou inválido, não pode definir alvo`);
        return;
      }
      
      // Parar comportamentos atuais
      this.stopWandering();
      this.stopAttacking();
      
      // Parar todos os timers
      this.clearAllTimers();
      
      // Definir o alvo
      this.aggroTarget = playerId;
      this.lastAggroTime = Date.now();
      
      // Mudar o estado para perseguição
      this.setState('aggro');
      
      // Começar a perseguir o alvo imediatamente
      this.pursueTarget();
      
      // Iniciar comportamento de ataque
      if (!this.attackIntervalId) {
        this.startAttacking();
      }
    } catch (error) {
      console.error("[MonsterAI] Erro ao definir alvo de agressividade:", error);
    }
  }
  
  /**
   * Persegue o alvo (jogador)
   */
  pursueTarget() {
    // Verificações básicas
    if (!this.isActive || this.monster.isDead || !this.aggroTarget) {
      this.loseAggroTarget();
      return;
    }
    
    try {
      // Obter o jogador alvo
      const targetPlayer = this.entityManager?.players.get(this.aggroTarget);
      
      // Verificar se o jogador é válido
      if (!targetPlayer || !targetPlayer.model || targetPlayer.isDead) {
        console.log(`[MonsterAI] Alvo ${this.aggroTarget} indisponível`);
        this.loseAggroTarget();
        return;
      }
      
      // Calcular distância até o jogador
      const monsterPosition = this.monster.model.position;
      const playerPosition = targetPlayer.model.position;
      const distance = monsterPosition.distanceTo(playerPosition);
      
      // Se o jogador estiver muito longe, desistir da perseguição
      if (distance > 30) {
        console.log(`[MonsterAI] Jogador muito longe (${distance.toFixed(1)}), desistindo`);
        this.loseAggroTarget();
        return;
      }
      
      // Se estiver dentro do alcance de ataque, iniciar ataque
      if (distance <= this.monster.attackRange * 1.2) {
        console.log(`[MonsterAI] Jogador no alcance de ataque (${distance.toFixed(1)})`);
        this.startAttacking();
        return;
      }
      
      // Mover em direção ao jogador
      console.log(`[MonsterAI] Perseguindo jogador - distância: ${distance.toFixed(1)}`);
      
      // Calcular direção normalizada
      const direction = new Vector3()
        .subVectors(playerPosition, monsterPosition)
        .normalize();
      
      // Calcular nova posição (IMPORTANTE: mantendo a altura Y atual)
      const moveSpeed = this.monster.moveSpeed || 0.05;
      const movementVector = new Vector3(
        direction.x * moveSpeed,
        0, // Não alterar a altura Y durante o movimento
        direction.z * moveSpeed
      );
      
      // CORREÇÃO: Manter altura fixa para evitar "voo"
      const FIXED_HEIGHT = 0.5;  // Altura padrão fixa
      
      const newPosition = new Vector3(
        monsterPosition.x + movementVector.x,
        FIXED_HEIGHT,  // Forçar altura fixa para evitar "voo"
        monsterPosition.z + movementVector.z
      );
      
      // Atualizar posição
      this.monster.model.position.copy(newPosition);
      
      // Girar para a direção do movimento
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.monster.model.rotation.y = targetRotation;
      
      // Indicar que o monstro está se movendo
      this.monster.isMoving = true;
      
      // Atualizar posição no sistema
      if (typeof this.monster.updatePosition === 'function') {
        this.monster.updatePosition();
      }
    } catch (error) {
      console.error("[MonsterAI] Erro ao perseguir alvo:", error);
    }
  }
  
  /**
   * Calcula ajustes para evitar colisões durante o movimento
   * @param {THREE.Vector3} direction - Direção original
   * @param {THREE.Vector3} position - Posição atual
   * @param {Array} entities - Lista de entidades a evitar
   * @param {number} radius - Raio de colisão
   * @returns {THREE.Vector3} - Direção ajustada
   */
  calculateCollisionAvoidance(direction, position, entities, radius) {
    // Parâmetros default
    radius = radius || 1.0;
    
    // Verificar se direção é válida
    if (!direction || !position) return direction;
    
    // Força para evitar colisões
    const avoidanceForce = new Vector3();
    let collisionsDetected = 0;
    
    try {
      // Verificar colisões com todas as entidades
      entities.forEach(entity => {
        // Pular a entidade atual
        if (!entity || !entity.model || entity === this.monster) return;
        
        // Pegar posição da entidade
        const entityPosition = entity.model.position;
        
        // Calcular vetor de distância
        const distanceVec = new Vector3().subVectors(position, entityPosition);
        const distance = distanceVec.length();
        
        // Se estiver próximo o suficiente para colisão
        const collisionThreshold = radius + (entity.collisionRadius || 0.5);
        if (distance < collisionThreshold) {
          // Calcular vetor para longe da entidade (normalizado)
          let force = 1.0 - (distance / collisionThreshold); // Mais forte quanto mais perto
          force = Math.min(force * 2, 1.5); // Limitar força máxima
          
          // Adicionar força normalizada
          avoidanceForce.add(
            distanceVec.normalize().multiplyScalar(force)
          );
          
          collisionsDetected++;
        }
      });
      
      // Se não houve colisões, retornar direção original
      if (collisionsDetected === 0) return direction;
      
      // Normalizar força resultante se houve múltiplas colisões
      if (collisionsDetected > 1) {
        avoidanceForce.divideScalar(collisionsDetected);
      }
      
      // Combinar direção original com força de evitação
      const resultDirection = direction.clone().add(
        avoidanceForce.multiplyScalar(1.5) // Aumentar um pouco a força de evitação
      ).normalize();
      
      return resultDirection;
    } catch (error) {
      console.error("[MonsterAI] Erro ao calcular evitação de colisões:", error);
      return direction; // Em caso de erro, manter a direção original
    }
  }
  
  /**
   * Obtém todas as entidades potenciais para colisão
   * @returns {Array} Lista de entidades
   */
  getAllEntities() {
    const entities = [];
    
    if (!this.entityManager) return entities;
    
    // Adicionar jogadores
    this.entityManager.players.forEach(player => {
      entities.push(player);
    });
    
    // Adicionar outros monstros (excluindo a si mesmo)
    this.entityManager.monsters.forEach(monster => {
      if (monster !== this.monster) {
        entities.push(monster);
      }
    });
    
    // Outras entidades com colisão podem ser adicionadas aqui
    
    return entities;
  }
  
  /**
   * Perde o alvo atual e volta para o estado de patrulha
   */
  loseAggroTarget() {
    try {
      if (!this.aggroTarget) return;
      
      console.log(`[MonsterAI] ${this.monster.id} perdendo alvo ${this.aggroTarget}`);
      
      // Limpar alvo
      this.aggroTarget = null;
      
      // Parar de atacar
      this.stopAttacking();
      
      // Mudar estado
      this.setState('idle');
      
      // Voltar para a posição de spawn se estiver muito longe
      const distanceToSpawn = this.monster.model ? 
        this.monster.model.position.distanceTo(this.spawnPosition) : 999;
      
      if (distanceToSpawn > this.wanderRadius * 2) {
        console.log(`[MonsterAI] Retornando para spawn, distância: ${distanceToSpawn.toFixed(1)}`);
        
        // Mover de volta à posição original
        const direction = new Vector3()
          .subVectors(this.spawnPosition, this.monster.model.position)
          .normalize();
        
        // Velocidade de retorno um pouco mais rápida
        const returnSpeed = (this.monster.moveSpeed || 0.05) * 1.2;
        
        // Criar temporizador para retorno (mais suave)
        const returnInterval = setInterval(() => {
          if (!this.monster || !this.monster.model || this.monster.isDead || this.aggroTarget) {
            clearInterval(returnInterval);
            return;
          }
          
          const currentPos = this.monster.model.position;
          const distanceToSpawn = currentPos.distanceTo(this.spawnPosition);
          
          if (distanceToSpawn < 0.5) {
            // Chegou ao destino
            this.monster.model.position.copy(this.spawnPosition);
            this.monster.isMoving = false;
            clearInterval(returnInterval);
            
            // Retirar tempo de inatividade
            setTimeout(() => {
              this.setState('wandering');
              this.scheduleNextWander();
            }, 1000);
          } else {
            // Mover em direção ao ponto de spawn
            const moveVector = direction.clone().multiplyScalar(returnSpeed);
            currentPos.add(moveVector);
            
            // Garantir que a rotação acompanhe o movimento
            const targetRotation = Math.atan2(direction.x, direction.z);
            this.monster.model.rotation.y = targetRotation;
            
            // Atualizar posição
            if (typeof this.monster.updatePosition === 'function') {
              this.monster.updatePosition();
            }
          }
        }, 16);
      } else {
        // Está perto do spawn, apenas volta ao comportamento normal
        this.setState('wandering');
        this.scheduleNextWander();
      }
    } catch (error) {
      console.error("[MonsterAI] Erro ao perder alvo:", error);
    }
  }
  
  /**
   * Inicia o comportamento de ataque
   */
  startAttacking() {
    // Verificações básicas
    if (!this.isActive || this.monster.isDead || !this.aggroTarget) {
      return;
    }
    
    // Parar movimento
    this.monster.isMoving = false;
    
    // Mudar estado
    this.setState('attack');
    console.log(`[MonsterAI] ${this.monster.id} INICIANDO ATAQUE contra jogador ${this.aggroTarget}`);
    
    // Limpar qualquer timer existente
    this.clearAllTimers();
    
    // Realizar primeiro ataque imediatamente
    this.performAttack();
    
    // Configurar timer para ataques subsequentes
    this.attackInterval = setInterval(() => {
      if (!this.monster || this.monster.isDead || !this.aggroTarget) {
        this.stopAttacking();
        return;
      }
      
      // Tentar atacar novamente
      this.performAttack();
    }, 1000); // Atacar a cada 1 segundo
  }
  
  /**
   * Executa um ataque contra o jogador alvo
   */
  performAttack() {
    try {
      // Verificações de segurança
      if (!this.monster || !this.aggroTarget || !this.isActive || this.monster.isDead) {
        this.stopAttacking();
        return;
      }
      
      // Verificar cooldown de ataque
      const now = Date.now();
      const attackInterval = this.monster.attackInterval || 1500; // Usar intervalo configurado ou padrão de 1.5s
      
      if (this.lastAttackTime && (now - this.lastAttackTime < attackInterval)) {
        return; // Ainda em cooldown
      }
      
      // Obter o jogador alvo
      const targetPlayer = this.entityManager?.players.get(this.aggroTarget);
      
      if (!targetPlayer || !targetPlayer.model || targetPlayer.isDead) {
        console.log(`[MonsterAI] Alvo de ataque ${this.aggroTarget} não disponível`);
        return;
      }
      
      // Verificar distância para ataque
      const attackRange = this.monster.attackRange || 1.5;
      const distance = this.monster.model.position.distanceTo(targetPlayer.model.position);
      
      if (distance > attackRange * 1.2) { // adicionar tolerância de 20%
        // Jogador fora de alcance, tentar se aproximar
        this.pursueTarget();
        return;
      }
      
      // Atacar o jogador!
      console.log(`[MonsterAI] 🔥 ${this.monster.id} atacando jogador ${targetPlayer.id}`);
      
      // Atualizar timestamp do último ataque
      this.lastAttackTime = now;
      
      // Executar ataque
      if (typeof this.monster.attackPlayer === 'function') {
        this.monster.attackPlayer(targetPlayer);
      }
      
      // Virar para a direção do jogador
      const direction = new Vector3()
        .subVectors(targetPlayer.model.position, this.monster.model.position)
        .normalize();
      
      // Ajustar rotação do monstro para olhar para o alvo
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.monster.model.rotation.y = targetRotation;
      
      // Atualizar a posição do nome do monstro
      if (typeof this.monster.updateNameDisplay === 'function') {
        this.monster.updateNameDisplay();
      }
    } catch (error) {
      console.error("[MonsterAI] Erro ao executar ataque:", error);
    }
  }
  
  /**
   * Para o comportamento de ataque
   */
  stopAttacking() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval);
      this.attackInterval = null;
    }
  }
  
  /**
   * Movimenta o monstro aleatoriamente dentro de sua área de patrulha
   */
  wander() {
    try {
      // Verificações básicas
      if (!this.monster || !this.monster.model || this.monster.isDead || this.aggroTarget) {
        return;
      }
      
      // Definir como ativo
      this.setState('wandering');
      
      // Gerar ponto aleatório dentro do raio de patrulha
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.wanderRadius;
      
      const newX = this.spawnPosition.x + Math.cos(angle) * radius;
      const newZ = this.spawnPosition.z + Math.sin(angle) * radius;
      
      // Criar posição alvo
      const targetPosition = new Vector3(newX, this.monster.model.position.y, newZ);
      
      // Verificar se o monstro já está na posição
      const distanceToTarget = this.monster.model.position.distanceTo(targetPosition);
      if (distanceToTarget < 0.2) {
        // Já está próximo, reagendar
        this.scheduleNextWander();
        return;
      }
      
      console.log(`[MonsterAI] ${this.monster.id} vagando para (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
      
      // Mover para o ponto gerado
      const moveToTarget = () => {
        // Verificações de segurança
        if (!this.monster || !this.monster.model || this.monster.isDead || this.monster.isAttacking || this.aggroTarget) {
          this.wanderIntervalId = null;
          return;
        }
        
        const currentPosition = this.monster.model.position;
        const direction = new Vector3()
          .subVectors(targetPosition, currentPosition)
          .normalize();
        
        // Calcular distância atual
        const distToTarget = currentPosition.distanceTo(targetPosition);
        
        // Se já chegou no destino
        if (distToTarget < 0.2) {
          if (this.wanderIntervalId) {
            clearInterval(this.wanderIntervalId);
            this.wanderIntervalId = null;
          }
          
          this.monster.isMoving = false;
          this.scheduleNextWander();
          return;
        }
        
        // Mover na direção
        const speed = this.monster.moveSpeed || 0.05;
        currentPosition.x += direction.x * speed;
        currentPosition.z += direction.z * speed;
        
        // CORREÇÃO: Manter altura fixa para evitar "voo"
        currentPosition.y = 0.5;  // Altura padrão fixa
        
        // Atualizar rotação para a direção do movimento
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.monster.model.rotation.y = targetRotation;
        
        // Marcar como em movimento
        this.monster.isMoving = true;
        
        // Atualizar posição
        if (typeof this.monster.updatePosition === 'function') {
          this.monster.updatePosition();
        }
      };
      
      // Iniciar movimento periódico
      this.wanderIntervalId = setInterval(moveToTarget, 16);  // ~60fps
    } catch (error) {
      console.error("[MonsterAI] Erro ao vagar:", error);
      this.scheduleNextWander(); // Tentar novamente depois
    }
  }
  
  /**
   * Atualiza a IA do monstro, chamado a cada frame
   */
  update() {
    if (!this.isActive || this.monster.isDead) return;
    
    // Verificar estado atual
    switch (this.state) {
      case 'idle':
        // Se o monstro está parado há muito tempo, considerar novo movimento
        const now = Date.now();
        if (!this.monster.isMoving && now - this.lastWanderTime > this.minWanderTime) {
          // Chance aleatória de se mover quando parado (10% a cada verificação)
          if (Math.random() < MONSTER_AI_CONFIG.wanderChance) {
            this.setState('wander');
            this.wander();
          }
        }
        break;
        
      case 'aggro':
        // Atualizar perseguição continuamente, não apenas quando parar
        if (this.aggroTarget) {
          this.pursueTarget();
        } else {
          // Sem alvo, voltar a perambular
          this.setState('idle');
          this.scheduleNextWander();
        }
        break;
        
      case 'attack':
        // Verificar se o alvo ainda está em alcance
        if (this.aggroTarget && this.entityManager) {
          const player = this.entityManager.players.get(this.aggroTarget);
          
          if (player && player.model && !player.isDead) {
            const distance = this.monster.model.position.distanceTo(player.model.position);
            
            // Se o jogador saiu do alcance de ataque, voltar a perseguir
            if (distance > this.monster.attackRange) {
              this.stopAttacking();
              this.setState('aggro');
              this.pursueTarget();
            }
          } else {
            // Jogador morto ou não existe mais
            this.stopAttacking();
            this.loseAggroTarget();
          }
        }
        break;
    }
  }
  
  /**
   * Reseta a IA quando o monstro respawna
   */
  reset() {
    // Limpar timers
    this.clearAllTimers();
    
    // Resetar estados
    this.state = 'idle';
    this.aggroTarget = null;
    this.lastWanderTime = 0;
    this.lastAttackTime = 0;
    
    // Atualizar posição de spawn se o monstro tiver respawnado em um local diferente
    if (this.monster.model) {
      this.spawnPosition = new THREE.Vector3(
        this.monster.model.position.x,
        this.monster.model.position.y,
        this.monster.model.position.z
      );
    }
    
    // Reiniciar comportamentos
    if (this.isAggressive) {
      this.startCheckingForPlayers();
    }
    
    this.scheduleNextWander();
  }
  
  /**
   * Interrompe o movimento do monstro
   */
  stopMoving() {
    if (this.monster.isMoving) {
      this.monster.isMoving = false;
      console.log(`[MonsterAI.stopMoving] Monstro ${this.monster.id} parou de se mover`);
    }
  }
} 