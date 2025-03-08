import * as THREE from 'three';
import { MONSTER_AI_CONFIG } from '../core/config';

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
    
    this.spawnPosition = monster.model ? new THREE.Vector3(
      monster.model.position.x,
      monster.model.position.y,
      monster.model.position.z
    ) : new THREE.Vector3(0, 0, 0);
    
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
    if (!playerId) {
      console.error("[MonsterAI.setAggroTarget] ID do jogador não fornecido");
      return;
    }
    
    // Verificações de segurança
    if (!this.isActive) {
      console.log(`[MonsterAI.setAggroTarget] IA não está ativa para monstro ${this.monster.id}`);
      return;
    }
    
    if (this.monster.isDead) {
      console.log(`[MonsterAI.setAggroTarget] Monstro ${this.monster.id} está morto, não pode ficar agressivo`);
      return;
    }
    
    // Registrar a tentativa
    console.log(`[MonsterAI.setAggroTarget] Monstro ${this.monster.id} tentando ficar agressivo contra ${playerId}`);
    
    // Interromper qualquer movimento atual imediatamente
    if (this.monster.isMoving) {
      console.log(`[MonsterAI.setAggroTarget] Interrompendo movimento do monstro ${this.monster.id}`);
      this.monster.stopMovement();
    }
    
    // Parar comportamento de perambulação
    this.stopWandering();
    
    // Se já estiver perseguindo esse alvo, apenas atualizar o estado
    if (this.aggroTarget === playerId) {
      console.log(`[MonsterAI.setAggroTarget] Monstro ${this.monster.id} já está perseguindo o jogador ${playerId}`);
      
      // Garantir estado correto
      if (this.state !== 'aggro' && this.state !== 'attack') {
        this.setState('aggro');
      }
      
      // Mesmo assim, tentar perseguição novamente - pode ter sido interrompida
      console.log(`[MonsterAI.setAggroTarget] Reiniciando perseguição imediata`);
      this.pursueTarget();
      
      return;
    }
    
    // Armazenar novo alvo
    console.log(`[MonsterAI.setAggroTarget] Monstro ${this.monster.id} agora perseguirá o jogador ${playerId}`);
    this.aggroTarget = playerId;
    
    // Limpar timeout de perda de agressividade se existir
    if (this.aggroTimeout) {
      clearTimeout(this.aggroTimeout);
      this.aggroTimeout = null;
    }
    
    // Mudar imediatamente para estado agressivo
    this.setState('aggro');
    
    // Iniciar perseguição IMEDIATAMENTE, sem qualquer delay
    console.log(`[MonsterAI.setAggroTarget] Monstro ${this.monster.id} iniciando perseguição imediata do jogador ${playerId}`);
    this.pursueTarget();
  }
  
  /**
   * Persegue o alvo (jogador) dentro do range de detecção
   */
  pursueTarget() {
    if (!this.isActive || this.monster.isDead) {
      console.log(`[MonsterAI.pursueTarget] Monstro ${this.monster.id} não pode perseguir (inativo/morto)`);
      this.stopMoving();
      return;
    }
    
    // Verificar se temos um alvo de aggro válido
    if (!this.aggroTarget) {
      this.loseAggroTarget();
      return;
    }
    
    // Buscar o jogador pelo ID do alvo
    const entityManager = this.entityManager;
    if (!entityManager) {
      console.error(`[MonsterAI.pursueTarget] EntityManager não disponível para monstro ${this.monster.id}`);
      return;
    }
    
    const players = entityManager.players;
    let targetPlayer = null;
    
    // Encontrar o jogador pelo ID
    if (players.has(this.aggroTarget)) {
      targetPlayer = players.get(this.aggroTarget);
    }
    
    if (!targetPlayer || !targetPlayer.model) {
      console.log(`[MonsterAI.pursueTarget] Jogador alvo ${this.aggroTarget} não encontrado, perdendo interesse`);
      this.loseAggroTarget();
      return;
    }
    
    // Calcular distância até o alvo
    if (this.monster.model && targetPlayer.model) {
      const monsterPosition = this.monster.model.position;
      const targetPosition = targetPlayer.model.position;
      const distance = monsterPosition.distanceTo(targetPosition);
      
      // Verificar se está dentro do range de ataque
      if (distance <= this.monster.attackRange) {
        console.log(`[MonsterAI.pursueTarget] Monstro ${this.monster.id} alcançou o jogador ${this.aggroTarget}, iniciando ataque`);
        this.setState('attack');
        this.startAttacking();
        return;
      }
      
      // Verificar se está fora do range de perseguição
      if (distance > this.monster.aggroRange * 1.5) {
        console.log(`[MonsterAI.pursueTarget] Jogador ${this.aggroTarget} saiu do alcance, perdendo interesse`);
        this.loseAggroTarget();
        return;
      }
      
      // Calcular direção normalizada para o jogador
      const direction = new THREE.Vector3();
      direction.subVectors(targetPosition, monsterPosition).normalize();
      
      // SISTEMA DE COLISÃO: Checar colisões com outros jogadores e entidades
      const allEntities = this.getAllEntities();
      const collisionRadius = this.monster.collisionRadius || 1.0; // Raio de colisão padrão
      let adjustedDirection = this.calculateCollisionAvoidance(direction, monsterPosition, allEntities, collisionRadius);
      
      // Calcular a nova posição considerando a direção ajustada
      const moveSpeed = this.monster.moveSpeed || 0.05;
      const newPosition = monsterPosition.clone().add(adjustedDirection.multiplyScalar(moveSpeed));
      
      // Atualizar posição
      this.monster.model.position.copy(newPosition);
      
      // Girar o modelo para a direção do movimento
      if (adjustedDirection.lengthSq() > 0.001) {
        const targetRotation = Math.atan2(adjustedDirection.x, adjustedDirection.z);
        this.monster.model.rotation.y = targetRotation;
      }
      
      this.startMovingAnimation();
    }
  }
  
  /**
   * Calcula a direção ajustada para evitar colisões
   * @param {THREE.Vector3} direction - Direção original
   * @param {THREE.Vector3} position - Posição atual
   * @param {Array} entities - Lista de entidades para verificar colisão
   * @param {number} radius - Raio de colisão
   * @returns {THREE.Vector3} - Direção ajustada
   */
  calculateCollisionAvoidance(direction, position, entities, radius) {
    // Criar cópia da direção original
    const adjustedDirection = direction.clone();
    
    // Força total de repulsão
    const avoidanceForce = new THREE.Vector3();
    
    // Verificar cada entidade para possíveis colisões
    for (const entity of entities) {
      // Ignorar a própria entidade (monstro) e entidades sem modelo
      if (entity === this.monster || !entity.model) continue;
      
      // Distância mínima de colisão (soma dos raios)
      const entityRadius = entity.collisionRadius || 0.5; // Raio padrão para outras entidades
      const minDistance = radius + entityRadius;
      
      // Calcular distância entre as entidades
      const entityPosition = entity.model.position;
      const distanceVec = new THREE.Vector3().subVectors(position, entityPosition);
      const distance = distanceVec.length();
      
      // Se estiver dentro do raio de colisão, calcular força de repulsão
      if (distance < minDistance) {
        console.log(`[MonsterAI.Colisão] Evitando colisão com ${entity.id || 'entidade'} (distância: ${distance.toFixed(2)} < ${minDistance.toFixed(2)})`);
        
        // Normalizar o vetor de distância
        if (distance > 0) {
          distanceVec.normalize();
        } else {
          // Se estão exatamente no mesmo lugar, gerar um vetor aleatório
          distanceVec.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }
        
        // Calcular força de repulsão (inversamente proporcional à distância)
        const force = Math.max(0, 1.0 - distance / minDistance);
        avoidanceForce.add(distanceVec.multiplyScalar(force * 1.5)); // Fator 1.5 para aumentar a força
      }
    }
    
    // Aplicar força de repulsão à direção original
    if (avoidanceForce.lengthSq() > 0) {
      // Adicionar força de repulsão (com menor peso) à direção
      adjustedDirection.add(avoidanceForce);
      adjustedDirection.normalize(); // Normalizar para manter a velocidade
    }
    
    return adjustedDirection;
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
   * Perde o alvo atual após um tempo
   */
  loseAggroTarget() {
    if (!this.aggroTarget) return;
    
    console.log(`Monstro ${this.monster.id} perdeu o alvo ${this.aggroTarget}`);
    
    // Parar o ataque se estiver atacando
    if (this.state === 'attack') {
      if (this.attackInterval) {
        clearInterval(this.attackInterval);
        this.attackInterval = null;
      }
    }
    
    // Registrar quando perdeu o alvo
    this.aggroLostTime = Date.now();
    
    // Definir timeout para voltar ao estado normal
    this.aggroTimeout = setTimeout(() => {
      this.aggroTarget = null;
      this.setState('idle');
      this.scheduleNextWander();
    }, this.aggroDuration);
  }
  
  /**
   * Inicia o comportamento de ataque
   */
  startAttacking() {
    if (!this.isActive || this.monster.isDead || !this.aggroTarget) {
      console.log(`MonsterAI.startAttacking: Monstro ${this.monster.id} não pode iniciar ataque (inativo/morto/sem alvo)`);
      return;
    }
    
    console.log(`MonsterAI.startAttacking: Monstro ${this.monster.id} iniciando comportamento de ataque contra ${this.aggroTarget}`);
    
    // Garantir que estamos no estado correto
    if (this.state !== 'attack') {
      this.setState('attack');
    }
    
    // Parar qualquer movimento
    if (this.monster.isMoving) {
      this.monster.stopMovement();
    }
    
    // Cancelar qualquer ataque em progresso
    if (this.attackInterval) {
      clearInterval(this.attackInterval);
      this.attackInterval = null;
    }
    
    // Iniciar ciclo de ataques
    this.performAttack();
    
    // Configurar intervalo de ataques
    this.attackInterval = setInterval(() => {
      this.performAttack();
    }, this.monster.attackInterval || MONSTER_AI_CONFIG.attackInterval);
  }
  
  /**
   * Executa um ataque ao jogador alvo
   */
  performAttack() {
    if (!this.isActive || this.monster.isDead || !this.aggroTarget) {
      console.log(`[MonsterAI.performAttack] Monstro ${this.monster.id} não pode atacar (inativo/morto/sem alvo)`);
      this.stopAttacking();
      return;
    }
    
    // Obter o jogador alvo
    const entityManager = this.entityManager;
    if (!entityManager) {
      console.error(`[MonsterAI.performAttack] EntityManager não disponível para monstro ${this.monster.id}`);
      return;
    }
    
    const players = entityManager.players;
    let targetPlayer = null;
    
    // Encontrar o jogador pelo ID
    if (players.has(this.aggroTarget)) {
      targetPlayer = players.get(this.aggroTarget);
    }
    
    if (!targetPlayer || !targetPlayer.model) {
      console.log(`[MonsterAI.performAttack] Jogador alvo ${this.aggroTarget} não encontrado para monstro ${this.monster.id}`);
      this.loseAggroTarget();
      return;
    }
    
    // Verificar se o jogador está no alcance de ataque
    if (this.monster.model && targetPlayer.model) {
      const distance = this.monster.model.position.distanceTo(targetPlayer.model.position);
      console.log(`[MonsterAI.performAttack] Distância para ataque: ${distance.toFixed(2)}, alcance: ${this.monster.attackRange}`);
      
      // Se estiver fora do alcance, voltar a perseguir
      if (distance > this.monster.attackRange * 1.2) {
        console.log(`[MonsterAI.performAttack] Jogador ${this.aggroTarget} fora de alcance, voltando a perseguir`);
        this.setState('aggro');
        this.stopAttacking();
        this.pursueTarget();
        return;
      }
      
      // Realizar o ataque se estiver em alcance
      console.log(`[MonsterAI.performAttack] Monstro ${this.monster.id} atacando jogador ${this.aggroTarget}`);
      
      // Criar efeito visual de ataque
      if (this.monster.scene && this.monster.scene.renderer) {
        this.monster.scene.renderer.createAttackEffect(
          this.monster.model.position.clone(),
          targetPlayer.model.position.clone()
        );
      }
      
      // BALANCEAMENTO DE DANO
      // Obter nível e ataque do monstro
      const monsterLevel = this.monster.combatStats ? this.monster.combatStats.level : 1;
      const monsterAttack = this.monster.combatStats ? this.monster.combatStats.attack : this.monster.attackDamage;
      
      // Obter nível e defesa do jogador
      const playerLevel = targetPlayer.combatStats ? targetPlayer.combatStats.level : 
                         (targetPlayer.level || 10); // Nível padrão 10 para jogadores
      const playerDefense = targetPlayer.combatStats ? targetPlayer.combatStats.defense : 
                           (targetPlayer.defense || 20); // Defesa padrão 20 para jogadores
      
      // Calcular fator de nível - monstros de nível inferior causam menos dano
      const levelFactor = Math.max(0.5, monsterLevel / Math.max(1, playerLevel));
      
      // Calcular fator de defesa - quanto maior a defesa, menor o dano
      // Fórmula: quanto maior a defesa, menor o dano (com um mínimo garantido)
      const defenseFactor = 1 - Math.min(0.75, playerDefense / (playerDefense + 50 + monsterLevel * 5));
      
      // Calcular dano base
      const baseDamage = monsterAttack * levelFactor;
      
      // Aplicar defesa e variação aleatória
      const randomVariation = 0.8 + (Math.random() * 0.4); // 80% a 120%
      const finalDamage = Math.max(1, Math.floor(baseDamage * defenseFactor * randomVariation));
      
      console.log(`[MonsterAI.performAttack] Cálculo de dano: ${monsterAttack} (ataque) * ${levelFactor.toFixed(2)} (nível) * ${defenseFactor.toFixed(2)} (defesa) * ${randomVariation.toFixed(2)} (variação) = ${finalDamage}`);
      
      // Aplicar dano (através do EntityManager para processamento correto)
      if (entityManager.damagePlayer) {
        entityManager.damagePlayer(this.aggroTarget, finalDamage, this.monster.id);
      } else {
        // Fallback: aplicar dano diretamente
        if (targetPlayer.takeDamage) {
          targetPlayer.takeDamage(finalDamage, this.monster.id);
        }
      }
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
   * Faz o monstro se mover para uma posição aleatória dentro do raio de perambulação
   */
  wander() {
    if (!this.isActive || !this.monster.model || this.monster.isDead || this.monster.isMoving 
        || this.state === 'aggro' || this.state === 'attack') return;
    
    // Gerar um ponto aleatório dentro do raio de perambulação
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = Math.random() * this.wanderRadius;
    
    // Calcular nova posição (mantendo a altura y atual)
    const newX = this.spawnPosition.x + Math.cos(randomAngle) * randomRadius;
    const newZ = this.spawnPosition.z + Math.sin(randomAngle) * randomRadius;
    
    // Definir posição alvo
    const targetPosition = new THREE.Vector3(newX, this.monster.model.position.y, newZ);
    
    // Iniciar movimento
    console.log(`Monstro ${this.monster.id} perambulando para (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
    this.monster.moveToPosition(targetPosition);
    
    // Registrar tempo do último movimento
    this.lastWanderTime = Date.now();
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
} 