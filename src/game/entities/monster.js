import * as THREE from 'three';
import { Entity } from './entity';
import { createTextTexture } from '../utils/helpers';
import { MonsterAI } from './monsterAI';
import { MONSTER_AI_CONFIG, COMBAT_CONFIG } from '../core/config';
import { debug } from '../utils/helpers';

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
    this.attackRange = data.attackRange || 1;
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
   * @returns {THREE.Object3D} O modelo criado
   */
  createMonsterModel() {
    // Se não temos a cena, não podemos criar o modelo
    if (!this.scene) return null;
    
    // Verificar se o tipo é "poring" para criar um cubo temporário
    if (this.type === 'poring') {
      console.log("[Monster] Criando cubo temporário para o poring");
      
      // Criar um cubo rosa como substituto temporário para o poring
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshLambertMaterial({ color: 0xFF9999 });  // Rosa claro
      this.model = new THREE.Mesh(geometry, material);
      
      // Adicionar à cena
      this.scene.add(this.model);
      
      // Configurar posição
      if (this.data.position) {
        this.model.position.set(
          this.data.position.x || 0,
          0.5, // Metade da altura do cubo
          this.data.position.z || 0
        );
      }
      
      return this.model;
    }
    
    // Para outros tipos, continuar com o modelo padrão (esfera)
    // Geometria do monstro (uma esfera para representar o monstro)
    const monsterGeometry = new THREE.SphereGeometry(0.5, 32, 16);
    
    // Definir cor com base no tipo
    let monsterColor = 0xff0000; // Vermelho padrão
    
    switch (this.type) {
      case 'poring':
        monsterColor = 0xff88cc; // Rosa
        break;
      case 'zombie':
        monsterColor = 0x448855; // Verde escuro
        break;
      case 'wolf':
        monsterColor = 0x777777; // Cinza
        break;
      default:
        monsterColor = 0xff0000; // Vermelho padrão
    }
    
    // Material do monstro
    const monsterMaterial = new THREE.MeshStandardMaterial({ color: monsterColor });
    
    // Criar o modelo
    this.model = this.createModel(monsterGeometry, monsterMaterial);
    
    // CORREÇÃO: Garantir que o modelo esteja corretamente posicionado acima do chão
    if (this.model) {
      // Garantir que a altura Y seja pelo menos o raio da esfera (0.5)
      if (this.model.position.y < 0.5) {
        this.model.position.y = 0.5;
      }
      
      // Adicionar dados ao modelo para facilitar identificação
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
    
    // Aplicar posição inicial se disponível
    if (this.data.position) {
      this.model.position.set(
        this.data.position.x || 0,
        0.5, // CORREÇÃO: Altura fixa para todos os monstros
        this.data.position.z || 0
      );
    } else {
      // Posição padrão
      this.model.position.set(0, 0.5, 0);
    }
    
    return this.model;
  }
  
  /**
   * Atualiza o monstro a cada frame
   */
  update() {
    // Pular se estiver morto ou sem modelo
    if (this.isDead || !this.model) return;
    
    // Atualizar movimento se estiver se movendo
    if (this.isMoving) {
      this.updateMovement(this.moveSpeed);
    }
    
    // Animação especial para o poring
    if (this.type === 'poring') {
      try {
        // Adicionar pulo suave para o modelo do poring
        const time = Date.now() * 0.001; // Tempo em segundos
        const bounceHeight = 0.1; // Altura do pulo
        const bounceSpeed = 1.5; // Velocidade do pulo
        
        // Verificar a estrutura do modelo e aplicar a animação apropriadamente
        // No caso do cubo simples, aplicar diretamente ao modelo principal
        this.model.position.y = 0.5 + Math.sin(time * bounceSpeed) * bounceHeight;
        
        // Adicionar rotação quando estiver se movendo
        if (this.isMoving) {
          // Rotacionar o modelo na direção do movimento
          this.model.rotation.y += 0.05;
        }
      } catch (error) {
        console.warn(`[Monster] Erro ao animar poring: ${error.message}`);
      }
    }
    
    // Atualizar a posição para o sistema de combate
    this.updatePosition();
    
    // Atualizar IA
    if (this.ai && !this.isDead) {
      this.ai.update();
    }
  }
  
  /**
   * Ataca um jogador
   * @param {Player} player - Jogador alvo do ataque
   * @returns {boolean} Indica se o ataque foi bem-sucedido
   */
  attackPlayer(player) {
    try {
      // Verificar se o jogador é válido
      if (!player || !player.model || player.isDead) {
        console.log(`[Monster] Jogador inválido, não pode atacar`);
        return false;
      }
      
      // Verificar cooldown de ataque
      const now = Date.now();
      if (this.lastAttackTime && now - this.lastAttackTime < this.attackInterval) {
        // Ainda em cooldown
        return false;
      }
      
      this.lastAttackTime = now;
      
      // Calcular distância
      const distance = this.model.position.distanceTo(player.model.position);
      if (distance > this.attackRange * 1.2) {
        console.log(`[Monster] Jogador fora de alcance: ${distance.toFixed(1)} > ${this.attackRange}`);
        return false;
      }
      
      console.log(`[Monster] 🔥 ${this.id} atacando jogador ${player.id}`);
      
      // Calcular dano com variação aleatória
      const damageVariation = 0.2; // 20% de variação para mais ou para menos
      const randomFactor = 1 - damageVariation + Math.random() * damageVariation * 2;
      const baseDamage = this.attackDamage || 3;
      const finalDamage = Math.max(1, Math.floor(baseDamage * randomFactor));
      
      // Calcular dano final (aplicando defesa do jogador)
      const playerDefenseMultiplier = player.defenseMultiplier || 0;
      const finalDamageAfterDefense = Math.max(1, Math.floor(finalDamage * (1 - playerDefenseMultiplier)));
      
      // Notificar o jogador do ataque (REMOVIDO ALERT PARA NÃO INTERROMPER O JOGO)
      console.log(`[Monster] ⚔️ ${this.id} causando ${finalDamageAfterDefense} de dano em ${player.id}`);
      
      // Emitir evento de rede para sincronizar com servidor
      if (this.networkManager) {
        this.networkManager.emit('monsterAttack', {
          monsterId: this.id,
          targetId: player.id,
          damage: finalDamageAfterDefense
        });
      }
      
      // CRUCIAL: Aplicar dano diretamente ao jogador
      if (player.takeDamage && typeof player.takeDamage === 'function') {
        player.takeDamage(finalDamageAfterDefense, this.id);
        
        // Mostrar efeito visual
        if (player.showDamageEffect && typeof player.showDamageEffect === 'function') {
          player.showDamageEffect(finalDamageAfterDefense);
        }
        
        // Mostrar mensagem na tela (sem alert)
        if (player.id === window.game?.entityManager?.localPlayerId) {
          console.log(`🔥 Você recebeu ${finalDamageAfterDefense} de dano de ${this.type}!`);
          
          // Opcional: mostrar um efeito visual não bloqueante
          if (window.game && window.game.ui) {
            window.game.ui.showMessage(`Recebeu ${finalDamageAfterDefense} de dano de ${this.type}!`, 2000, 'damage');
          }
        }
      }
      
      // Criar efeito visual
      if (this.scene && this.scene.renderer) {
        this.scene.renderer.createAttackEffect(
          this.model.position.clone(),
          player.model.position.clone(),
          0xffaa00, // Laranja para ataques de monstro
          300
        );
      }
      
      return true;
    } catch (error) {
      console.error(`[Monster] Erro ao atacar jogador:`, error);
      return false;
    }
  }
  
  /**
   * Recebe dano
   * @param {number} damage - Quantidade de dano recebido
   * @param {string} attackerId - ID do jogador que causou o dano
   * @returns {number} HP restante
   */
  takeDamage(damage, attackerId) {
    try {
      // Garantir que o dano seja numérico
      damage = Number(damage) || 0;
      
      // Garantir que seja pelo menos 1 ponto de dano
      damage = Math.max(1, damage);
      
      debug('combat', `Monstro ${this.id} recebendo ${damage} de dano de ${attackerId}`);
      
      // Se já estiver morto, não fazer nada
      if (this.isDead) {
        debug('combat', `Monstro ${this.id} já está morto`);
        return 0;
      }
      
      // Parar qualquer movimento atual
      if (typeof this.stopMovement === 'function') {
        this.stopMovement();
      }
      
      // IMPORTANTE: Atualizar HP - garantindo que reduza de fato
      const hpAntes = this.hp;
      this.hp = Math.max(0, this.hp - damage);
      
      debug('combat', `Monstro ${this.id}: HP alterado de ${hpAntes} para ${this.hp}`);
      
      // Garantir que os dados estejam atualizados
      if (this.data) {
        this.data.hp = this.hp;
      }
      
      // Atualizar sistema de combate se disponível
      if (this.combatStats) {
        this.combatStats.hp = this.hp;
      }
      
      // Mostrar efeito visual de dano
      if (typeof this.showDamageEffect === 'function') {
        this.showDamageEffect(damage);
      }
      
      // IMPORTANTE: Atualizar o display do nome com o novo HP
      // Usar setTimeout para garantir que a atualização aconteça após o estado ser atualizado
      setTimeout(() => {
        if (typeof this.updateNameDisplay === 'function' && !this.isDead) {
          try {
            this.updateNameDisplay();
            debug('combat', `Display de nome atualizado para monstro ${this.id}`);
          } catch (e) {
            console.error(`[Monster] Erro ao atualizar display de nome:`, e);
          }
        }
      }, 50);
      
      // Verificar se morreu
      if (this.hp <= 0) {
        debug('combat', `Monstro ${this.id} morreu após receber ${damage} de dano`);
        
        // Garantir que o HP fique em zero
        this.hp = 0;
        
        // Definir como morto para aplicar efeitos visuais
        this.isDead = true;
        
        // Executar a morte
        if (typeof this.die === 'function') {
          this.die();
        }
        
        return 0;
      }
      
      // IMPORTANTE: Se o monstro não estiver morto, torna-se agressivo com o atacante
      if (!this.isDead && this.ai && typeof this.ai.setAggroTarget === 'function') {
        try {
          debug('ai', `Monstro ${this.id} tornando-se agressivo contra ${attackerId}`);
          this.ai.setAggroTarget(attackerId);
        } catch (e) {
          console.error('Erro ao definir alvo de agressividade:', e);
        }
      }
      
      return this.hp;
    } catch (error) {
      console.error(`[Monster.takeDamage] Erro ao processar dano:`, error);
      return this.hp || 0;
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
   * Respawna o monstro
   */
  respawn() {
    debug('combat', `Monstro ${this.id} respawnando...`);
    
    // Restaurar HP
    this.hp = this.maxHp;
    
    // Restaurar estado
    this.isDead = false;
    
    // Restaurar modelo 3D
    if (this.model) {
      this.model.visible = true;
      
      // Determinar nova posição - usar dados recebidos do servidor se existirem
      let newX, newZ;
      
      if (this.data.position) {
        // Usar posição atualizada enviada pelo servidor (prioridade)
        newX = this.data.position.x;
        newZ = this.data.position.z;
        debug('combat', `Usando posição do servidor para respawn: (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
      } 
      else if (this.data.originalPosition) {
        // Se não tem posição específica, gerar posição aleatória baseada na original
        const respawnRadius = MONSTER_AI_CONFIG.respawnRadius || 15;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * respawnRadius;
        
        newX = this.data.originalPosition.x + Math.cos(angle) * distance;
        newZ = this.data.originalPosition.z + Math.sin(angle) * distance;
        
        debug('combat', `Gerando posição aleatória para respawn: (${newX.toFixed(2)}, ${newZ.toFixed(2)})`);
      } else {
        // Posição padrão se não houver referência
        newX = 0;
        newZ = 0;
      }
      
      // Aplicar nova posição ao modelo
      this.model.position.set(
        newX,
        0.5, // Altura fixa padrão
        newZ
      );
      
      // Atualizar dados de posição
      if (!this.data.position) {
        this.data.position = {};
      }
      this.data.position.x = newX;
      this.data.position.y = 0.5;
      this.data.position.z = newZ;
    }
    
    // Reativar IA
    if (this.ai) {
      this.ai.reset();
      this.ai.activate();
    }
    
    // Atualizar exibição
    this.updateNameDisplay();
    this.updateVisuals();
    
    // Criar efeito visual de respawn (brilho)
    this.showRespawnEffect();
  }
  
  /**
   * Mostra um efeito visual de respawn
   */
  showRespawnEffect() {
    if (!this.model || !this.scene) return;
    
    try {
      // Criar um brilho ao redor do monstro
      const geometry = new THREE.SphereGeometry(1.5, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5
      });
      
      const effectMesh = new THREE.Mesh(geometry, material);
      effectMesh.position.copy(this.model.position);
      this.scene.add(effectMesh);
      
      // Animar o efeito
      const startTime = Date.now();
      const duration = 1000;
      
      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Escalar o efeito
        effectMesh.scale.set(
          1 + progress,
          1 + progress,
          1 + progress
        );
        
        // Diminuir a opacidade
        material.opacity = 0.5 * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Remover o efeito quando terminar
          this.scene.remove(effectMesh);
          material.dispose();
          geometry.dispose();
        }
      };
      
      // Iniciar animação
      animate();
    } catch (error) {
      console.error("Erro ao mostrar efeito de respawn:", error);
    }
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
   * Atualiza a posição do monstro para sincronização
   */
  updatePosition() {
    if (!this.model) return;
    
    // CORREÇÃO: Forçar altura Y correta para todos os monstros
    const FIXED_HEIGHT = 0.5; // Altura padrão dos monstros
    
    // Sempre manter a altura Y fixa para evitar "voo"
    if (this.model.position.y !== FIXED_HEIGHT && this.type !== 'poring') {
      this.model.position.y = FIXED_HEIGHT;
    }
    
    // Atualizar posição
    this.position = {
      x: this.model.position.x,
      y: this.model.position.y,
      z: this.model.position.z
    };
    
    // Atualizar a posição da tag de nome para seguir o monstro
    if (this.nameTag) {
      this.nameTag.position.set(
        this.model.position.x,
        this.model.position.y + 1.5, // Nome acima do monstro
        this.model.position.z
      );
    }
    
    // Tratar rotação especial para o modelo do poring
    if (this.type === 'poring' && this.isMoving) {
      try {
        // Fazer o poring girar enquanto se move (animação simples)
        const rotationSpeed = 0.05;
        this.model.rotation.y += rotationSpeed;
      } catch (error) {
        console.warn(`[Monster] Erro ao rotacionar poring: ${error.message}`);
      }
    }
  }
  
  /**
   * Atualiza o texto do nome
   * @param {string} name - Novo nome
   */
  updateNameTag(name) {
    try {
      if (!this.nameTag) {
        console.warn(`[Monster] updateNameTag: nameTag não existe para o monstro ${this.id}`);
        return;
      }
      
      // Criar nova textura
      const texture = createTextTexture(name);
      
      // Atualizar material
      if (this.nameTag.material.map) {
        this.nameTag.material.map.dispose();
      }
      
      this.nameTag.material.map = texture;
      this.nameTag.material.needsUpdate = true;
      
      debug('combat', `Nome do monstro ${this.id} atualizado para: ${name}`);
    } catch (error) {
      console.error(`[Monster] Erro ao atualizar nameTag:`, error);
    }
  }
  
  /**
   * Mostra um efeito visual de dano
   * @param {number} damage - Quantidade de dano
   */
  showDamageEffect(damage) {
    if (!this.model) return;
    
    console.log(`[Monster] Mostrando efeito de dano: ${damage}`);
    
    // 1. Flash vermelho intenso
    const originalColor = this.model.material.color.clone();
    this.model.material.color.set(0xff0000); // Vermelho brilhante
    this.model.material.emissive = new THREE.Color(0xff0000); // Adicionar emissão
    
    // Voltar à cor original após um tempo
    setTimeout(() => {
      if (this.model && this.model.material) {
        this.model.material.color.copy(originalColor);
        this.model.material.emissive = new THREE.Color(0x000000); // Remover emissão
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
    const jumpHeight = 0.3;
    
    // Subir
    this.model.position.y += jumpHeight;
    
    // Voltar à posição original
    setTimeout(() => {
      if (this.model) {
        // Usar animação suave para descer
        const steps = 10;
        const stepSize = jumpHeight / steps;
        
        const animateDown = (step) => {
          if (step < steps && this.model) {
            this.model.position.y -= stepSize;
            setTimeout(() => animateDown(step + 1), 20);
          } else if (this.model) {
            // Garantir posição final correta
            this.model.position.y = Math.max(0.5, originalY);
          }
        };
        
        animateDown(0);
      }
    }, 150);
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
    try {
      // Verificar se o modelo e a cena estão disponíveis
      if (!this.model || !this.scene) {
        console.warn(`[Monster] Impossível atualizar nameTag: modelo ou cena inválidos`);
        return;
      }
      
      // Criar texto atualizado com HP - garantir que não seja null/undefined
      const hp = this.hp || 0;
      const maxHp = this.maxHp || 100;
      const type = this.type || 'monster';
      
      // Formatação especial para destacar HP baixo
      const hpColor = hp < maxHp * 0.3 ? 'red' : (hp < maxHp * 0.6 ? 'yellow' : 'white');
      const displayName = `${type} (HP: ${hp}/${maxHp})`;
      
      // Debug
      debug('combat', `Atualizando nameTag do monstro ${this.id} para: ${displayName}`);
      
      // Se já existir uma nameTag, atualizá-la
      if (this.nameTag) {
        // Atualizar a textura
        const texture = createTextTexture(displayName);
        
        // Remover textura antiga para evitar vazamento de memória
        if (this.nameTag.material && this.nameTag.material.map) {
          this.nameTag.material.map.dispose();
        }
        
        // Aplicar nova textura
        this.nameTag.material.map = texture;
        this.nameTag.material.needsUpdate = true;
      } else {
        // Se não existir, criar uma nova
        this.createNameTag(displayName);
      }
      
      // Atualizar posição
      this.updateNameTagPosition();
      
    } catch (error) {
      console.error(`[Monster] Erro ao atualizar nameTag:`, error);
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