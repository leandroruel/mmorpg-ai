import * as THREE from 'three';
import { Entity } from './entity';
import { createTextTexture } from '../utils/helpers';
import { MonsterAI } from './monsterAI';
import { MONSTER_AI_CONFIG, COMBAT_CONFIG } from '../core/config';

/**
 * Classe que representa um monstro no jogo
 */
export class Monster extends Entity {
  constructor(id, data, scene, aiController = null) {
    super(id, 'monster');
    
    this.scene = scene;
    this.data = data || {};
    this.type = data.type || 'poring';
    this.level = data.level || 1;
    this.hp = data.hp || 20;
    this.maxHp = data.maxHp || 20;
    this.attackDamage = data.attackDamage || 5;
    this.attackRange = data.attackRange || 1.5;
    this.aggroRange = data.aggroRange || 5.0;
    this.moveSpeed = data.moveSpeed || 0.05;
    this.isDead = false;
    this.isMoving = false;
    this.model = null;
    
    // Propriedades de colisão
    this.collisionRadius = data.collisionRadius || 0.8; // Raio para colisão
    this.collisionEnabled = true; // Flag para habilitar/desabilitar colisão
    
    // Inicializar sistema de combate se disponível
    if (window.CombatSystem) {
      try {
        this.combatStats = new window.CombatStats({
          level: this.level,
          hp: this.hp,
          maxHp: this.maxHp,
          mp: 0,
          maxMp: 0,
          attack: this.attackDamage,
          defense: Math.floor(this.level * 2), // Defesa baseada no nível
          magicAttack: 0,
          magicDefense: Math.floor(this.level)
        });
        console.log(`[Monster] Estatísticas de combate criadas para monstro ${this.id}: `, this.combatStats);
      } catch (error) {
        console.error(`[Monster] Erro ao criar estatísticas de combate para monstro ${this.id}:`, error);
      }
    }
    
    // Aplicar configurações específicas do tipo
    this.applyTypeConfig();
    
    // Inicializar a IA do monstro
    this.ai = new MonsterAI(this);
    
    // Compatibilidade com o sistema de combate - inicializar posição após criar o modelo
    this.radius = 0.5; // Raio para cálculos de colisão
    
    // Ativar IA se configurado para isso
    if (MONSTER_AI_CONFIG.enabled) {
      // Ativamos com um pequeno atraso para garantir que o modelo esteja pronto
      setTimeout(() => {
        this.ai.activate();
      }, 1000);
    }
  }
  
  /**
   * Aplica configurações específicas com base no tipo de monstro
   */
  applyTypeConfig() {
    // Verificar se o tipo existe nas configurações, senão usar valores padrão
    const typeConfig = MONSTER_AI_CONFIG.monsterTypes[this.type] || MONSTER_AI_CONFIG.monsterTypes.poring;
    
    // Aplicar configurações
    this.isAggressive = typeConfig.isAggressive || false;
    this.aggroRadius = typeConfig.aggroRadius || 0;
    this.moveSpeed = typeConfig.moveSpeed || MONSTER_AI_CONFIG.moveSpeed;
    this.attackRange = typeConfig.attackRange || COMBAT_CONFIG.defaultAttackRange;
    this.attackDamage = typeConfig.attackDamage || 10;
    this.attackInterval = typeConfig.attackInterval || MONSTER_AI_CONFIG.attackInterval;
    this.color = typeConfig.color || 0xff0000;
    
    // Atualizar dados internos
    this.data.isAggressive = this.isAggressive;
    this.data.aggroRadius = this.aggroRadius;
  }
  
  /**
   * Cria o modelo 3D do monstro
   */
  createMonsterModel() {
    // Criar geometria e material
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: this.color });
    
    // Criar modelo usando o método da classe pai
    this.createModel(geometry, material);
    
    // Adicionar atributo para facilitar a seleção
    if (this.model) {
      this.model.userData.entityId = this.id;
      this.model.userData.entityType = 'monster';
      this.model.userData.monsterType = this.type;
      this.model.userData.isAggressive = this.isAggressive;
    }
    
    // Adicionar nome com tipo
    const displayName = `${this.type} (HP: ${this.hp}/${this.maxHp})`;
    this.createNameTag(displayName);
    
    // Após criar o modelo, inicializar as posições para o sistema de combate
    if (this.model) {
      this.position = this.getPosition();
      this.lastPosition = { ...this.position };
    }
    
    return this.model;
  }
  
  /**
   * Ataca um jogador
   * @param {Player} player - Jogador alvo do ataque
   * @returns {boolean} - Se o ataque foi bem-sucedido
   */
  attackPlayer(player) {
    if (!player || this.isDead) return false;
    
    // Enviar evento de ataque para o servidor
    if (this.scene.networkManager) {
      this.scene.networkManager.emit('monsterAttack', {
        monsterId: this.id,
        targetId: player.id,
        damage: this.attackDamage
      });
    }
    
    console.log(`Monstro ${this.id} atacou o jogador ${player.id} causando ${this.attackDamage} de dano`);
    return true;
  }
  
  /**
   * Atualiza o status do monstro
   */
  update() {
    // Atualizar movimento se estiver se movendo
    if (this.isMoving) {
      this.updateMovement(this.moveSpeed);
    }
    
    // Atualizar a posição para o sistema de combate
    this.updatePosition();
    
    // Atualizar IA
    if (this.ai && !this.isDead) {
      this.ai.update();
    }
  }
  
  /**
   * Aplica dano ao monstro
   * @param {number} damage - Quantidade de dano
   * @param {string} attackerId - ID do jogador que causou o dano
   * @returns {number} HP restante
   */
  takeDamage(damage, attackerId) {
    console.log(`[Monster.takeDamage] Monstro ${this.id} recebeu ${damage} de dano de ${attackerId}`);
    
    // Interromper qualquer movimento atual IMEDIATAMENTE
    if (this.isMoving) {
      console.log(`[Monster.takeDamage] Interrompendo movimento do monstro ${this.id}`);
      this.stopMovement();
    }
    
    // Verificar se estamos usando o sistema de combate
    if (this.combatStats) {
      console.log(`[Monster.takeDamage] Monstro ${this.id} utilizando sistema de combate para processar dano de ${attackerId}`);
      
      // Se não está morto e tem um atacante, ficar agressivo contra ele
      if (!this.isDead && attackerId && this.ai) {
        console.log(`[Monster.takeDamage] Monstro ${this.id} ficará agressivo contra ${attackerId}`);
        
        // Definir alvo e iniciar comportamento agressivo
        this.ai.setAggroTarget(attackerId);
        
        // Forçar mudança de estado para agressivo
        if (this.ai.state !== 'aggro' && this.ai.state !== 'attack') {
          this.ai.setState('aggro');
          
          // Forçar perseguição imediata - NÃO USAR TIMEOUT, é muito lento!
          if (this.ai && !this.isDead) {
            console.log(`[Monster.takeDamage] Iniciando perseguição imediata contra ${attackerId}`);
            this.ai.pursueTarget();
          }
        }
      }
      
      // Aplicar dano através do sistema de combate
      const damageResult = this.combatStats.applyDamage(damage, 'physical', attackerId);
      
      // Sincronizar dados internos com o sistema de combate
      this.hp = this.combatStats.hp;
      this.data.hp = this.hp;
      this.isDead = this.combatStats.isDead;
      
      // Atualizar o display do nome para mostrar HP
      this.updateNameDisplay();
      
      // Efeito visual de dano
      this.showDamageEffect(damage);
      
      return this.hp;
    } 
    // Fallback para o sistema antigo caso o sistema de combate não esteja disponível
    else {
      console.log(`[Monster.takeDamage] Monstro ${this.id} recebeu ${damage} de dano de ${attackerId} (sistema antigo)`);
      
      // Atualizar HP
      this.hp = Math.max(0, this.hp - damage);
      
      // Atualizar dados
      this.data.hp = this.hp;
      
      // Se não está morto e tem um atacante, ficar agressivo contra ele
      if (!this.isDead && attackerId && this.ai) {
        console.log(`[Monster.takeDamage] Monstro ${this.id} ficará agressivo contra ${attackerId} (sistema antigo)`);
        
        // Definir alvo e iniciar comportamento agressivo
        this.ai.setAggroTarget(attackerId);
        
        // Forçar mudança de estado para agressivo
        if (this.ai.state !== 'aggro' && this.ai.state !== 'attack') {
          this.ai.setState('aggro');
          
          // Forçar perseguição imediata - SEM TIMEOUT!
          if (this.ai && !this.isDead) {
            console.log(`[Monster.takeDamage] Iniciando perseguição imediata contra ${attackerId} (sistema antigo)`);
            this.ai.pursueTarget();
          }
        }
      }
      
      // Atualizar o display do nome para mostrar HP
      this.updateNameDisplay();
      
      // Efeito visual de dano
      this.showDamageEffect(damage);
      
      // Verificar se o monstro morreu
      if (this.hp <= 0 && !this.isDead) {
        this.die();
      }
      
      return this.hp;
    }
  }
  
  /**
   * Mata o monstro
   */
  die() {
    if (this.isDead) return;
    
    // Se tiver sistema de combate disponível, apenas sincronize o estado
    if (this.combatStats && this.combatStats.isDead) {
      this.isDead = true;
    } else {
      // Sistema antigo
      this.isDead = true;
      this.hp = 0;
      this.data.hp = 0;
    }
    
    console.log(`Monster.die: Monstro ${this.id} morreu`);
    
    // Parar movimento e IA
    this.stopMovement();
    if (this.ai) {
      this.ai.deactivate();
    }
    
    // Mostrar efeito de morte
    this.showDeathEffect();
    
    // Programar respawn se necessário
    setTimeout(() => {
      this.respawn();
    }, MONSTER_AI_CONFIG.respawnTime);
  }
  
  /**
   * Ressuscita o monstro
   */
  respawn() {
    if (!this.isDead) return;
    
    // Se tiver sistema de combate disponível
    if (this.combatStats) {
      // Reviver com HP máximo
      this.combatStats.revive(100);
      
      // Sincronizar
      this.hp = this.combatStats.hp;
      this.isDead = this.combatStats.isDead;
    } else {
      // Sistema antigo
      this.isDead = false;
      this.hp = this.maxHp;
    }
    
    // Atualizar dados
    this.data.hp = this.hp;
    
    console.log(`Monster.respawn: Monstro ${this.id} ressuscitado`);
    
    // Garantir que o modelo esteja visível
    if (this.model) {
      this.model.visible = true;
    }
    
    // Reativar IA
    if (this.ai) {
      this.ai.reset();
      this.ai.activate();
    }
    
    // Atualizar exibição
    this.updateNameDisplay();
    this.updateVisuals();
  }
  
  /**
   * Obtém a posição atual para uso no sistema de combate
   * @returns {Object} Coordenadas x, y, z
   */
  getPosition() {
    if (this.model) {
      return {
        x: this.model.position.x,
        y: this.model.position.y,
        z: this.model.position.z
      };
    }
    
    // Se o modelo ainda não foi criado, retornar valores padrão
    // ou usar a posição dos dados, se disponível
    if (this.data && this.data.position) {
      return {
        x: this.data.position.x || 0,
        y: this.data.position.y || 0,
        z: this.data.position.z || 0
      };
    }
    
    return { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Atualiza a posição para o sistema de combate
   */
  updatePosition() {
    // Atualizar a posição para o sistema de combate
    if (this.model) {
      this.position = this.getPosition();
      
      // Verificar se houve movimento significativo
      const dx = this.position.x - this.lastPosition.x;
      const dy = this.position.y - this.lastPosition.y;
      const dz = this.position.z - this.lastPosition.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist > 0.01) {
        this.lastPosition = { ...this.position };
      }
    }
  }
  
  /**
   * Atualiza o texto do nome
   * @param {string} name - Novo nome
   */
  updateNameTag(name) {
    if (!this.nameSprite) return;
    
    // Criar nova textura
    const texture = createTextTexture(name);
    
    // Atualizar material
    this.nameSprite.material.map.dispose();
    this.nameSprite.material.map = texture;
    this.nameSprite.material.needsUpdate = true;
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
   * Limpa recursos quando o monstro é removido
   */
  destroy() {
    // Desativar a IA
    if (this.ai) {
      this.ai.deactivate();
      this.ai = null;
    }
    
    // Chamar método de destruição da classe pai
    super.destroy();
  }
  
  /**
   * Atualiza o display do nome para mostrar HP atual
   */
  updateNameDisplay() {
    if (this.nameSprite) {
      const displayName = `${this.type} (HP: ${this.hp}/${this.maxHp})`;
      this.updateNameTag(displayName);
    }
  }
  
  /**
   * Atualiza os dados do monstro
   * @param {Object} data - Novos dados
   */
  updateData(data) {
    // Atualizar dados internos
    this.data = { ...this.data, ...data };
    
    // Atualizar posição se necessário
    if (data.position) {
      this.updatePosition(data.position);
    }
    
    // Atualizar HP se necessário
    if (data.hp !== undefined) {
      this.hp = data.hp;
      this.data.hp = data.hp;
      
      // Atualizar também no sistema de combate se disponível
      if (this.combatStats) {
        this.combatStats.hp = data.hp;
        this.isDead = this.combatStats.isDead = (data.hp <= 0);
      } else {
        this.isDead = (data.hp <= 0);
      }
      
      // Atualizar display do nome
      this.updateNameDisplay();
      
      // Se morreu, processar morte
      if (this.isDead && this.model && this.model.visible) {
        this.die();
      }
    }
  }
  
  /**
   * Atualiza os visuais do monstro
   */
  updateVisuals() {
    if (!this.model) return;
    
    // Garantir que o modelo esteja visível se não estiver morto
    if (!this.isDead) {
      this.model.visible = true;
    }
    
    // Aqui podemos adicionar efeitos visuais baseados no estado
    // Por exemplo, animações, efeitos de partículas, etc.
    
    // Atualizar cor da entidade baseada no tipo
    if (this.model.material) {
      this.model.material.color.setHex(this.color);
    }
  }
  
  /**
   * Mostra o efeito visual de morte
   */
  showDeathEffect() {
    if (!this.model) return;
    
    // Esconder o modelo quando o monstro morre
    this.model.visible = false;
    
    // Você pode adicionar efeitos de morte mais elaborados aqui:
    // - Animação de queda
    // - Efeito de desintegração
    // - Partículas
    // - Sons
    
    console.log(`Monster.showDeathEffect: Monstro ${this.id} morreu com efeito visual`);
  }
} 