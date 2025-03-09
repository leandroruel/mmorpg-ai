import * as THREE from 'three';
import { calculateApproachPosition } from '../utils/helpers';
import { VISUAL_EFFECTS } from '../core/config';

/**
 * Classe para gerenciar os controles de entrada do jogo
 */
export class InputManager {
  constructor(renderer, entityManager, player) {
    this.renderer = renderer;
    this.entityManager = entityManager;
    this.player = player;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isMoving = false;
    this.isAttacking = false;
    this.attackTarget = null;
    this.destinationMarker = null;
    
    // Adicionar estado de configurações
    this.config = {
      autoAttack: true
    };
    
    // Variáveis para auto ataque
    this.autoAttackTarget = null;
    this.autoAttackInterval = null;
    
    // Vincular métodos ao this para evitar problemas com eventos
    this.handleLeftClick = this.handleLeftClick.bind(this);
    this.handleRightClick = this.handleRightClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }
  
  /**
   * Inicializa os controles de entrada
   */
  initialize() {
    if (!this.renderer || !this.renderer.renderer) {
      console.error('Renderer não inicializado corretamente');
      return;
    }
    
    this.renderer.renderer.domElement.addEventListener('click', this.handleLeftClick);
    this.renderer.renderer.domElement.addEventListener('contextmenu', this.handleRightClick);
    
    // Adicionar listener para tecla de atalho de configurações
    document.addEventListener('keydown', this.handleKeyDown);
    
    console.log('Input manager inicializado');
  }
  
  /**
   * Remove os listeners de eventos
   */
  dispose() {
    if (this.renderer && this.renderer.renderer) {
      this.renderer.renderer.domElement.removeEventListener('click', this.handleLeftClick);
      this.renderer.renderer.domElement.removeEventListener('contextmenu', this.handleRightClick);
    }
    
    // Remover listener para tecla de atalho
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Limpar intervalo de auto ataque
    this.stopAutoAttack();
  }
  
  /**
   * Atualiza o jogador controlado pelo usuário
   * @param {Object} player - Novo jogador
   */
  setPlayer(player) {
    this.player = player;
  }
  
  /**
   * Configura o estado de movimento do jogador
   * @param {boolean} isMoving - Estado de movimento
   */
  setMoving(isMoving) {
    this.isMoving = isMoving;
  }
  
  /**
   * Define o estado de ataque do jogador
   * @param {boolean} isAttacking - Se o jogador está atacando
   * @param {string} target - Alvo do ataque
   * @param {boolean} shouldStopAutoAttack - Se deve interromper o auto ataque existente (padrão: true)
   */
  setAttacking(isAttacking, target = null, shouldStopAutoAttack = true) {
    this.isAttacking = isAttacking;
    this.attackTarget = target;
    
    // Parar auto-ataque apenas se solicitado
    if (!isAttacking && shouldStopAutoAttack && this.autoAttackInterval) {
      this.stopAutoAttack();
    }
    
    console.log(`[InputManager] Estado de ataque alterado: ${isAttacking ? 'Atacando' : 'Não atacando'} ${target ? target : ''}`);
  }
  
  /**
   * Converte coordenadas do clique do mouse para coordenadas normalizadas
   * @param {MouseEvent} event - Evento do mouse
   */
  updateMouseCoordinates(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
  
  /**
   * Manipula o clique esquerdo do mouse (ataque direto)
   * @param {MouseEvent} event - Evento do mouse
   */
  handleLeftClick(event) {
    event.preventDefault();
    
    // Se o jogador não estiver disponível, não fazer nada
    if (!this.player || !this.player.model) return;
    
    // Atualizar coordenadas do mouse
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    
    // Verificar interseção com monstros
    const monsters = this.entityManager.getMonsterModels();
    const monsterIntersects = this.raycaster.intersectObjects(monsters);
    
    // CASO: Clicou em um monstro para atacar
    if (monsterIntersects.length > 0) {
      const clickedMonster = monsterIntersects[0].object;
      const monsterId = this.entityManager.getEntityIdByModel(clickedMonster);
      
      if (monsterId) {
        console.log(`[InputManager] Clique em monstro: ${monsterId}`);
        
        // Obter o monstro
        const monster = this.entityManager.monsters.get(monsterId);
        if (!monster || monster.isDead) {
          console.log(`[InputManager] Monstro não disponível: ${monsterId}`);
          return;
        }
        
        // Verificar distância
        const distance = this.player.model.position.distanceTo(monster.model.position);
        
        if (distance <= this.player.attackRange * 1.2) {
          // Já está em alcance, atacar diretamente
          console.log(`[InputManager] Atacando monstro: ${monsterId} (distância: ${distance.toFixed(1)})`);
          
          // Atacar o monstro uma vez
          const attackSuccess = this.player.attackEntity(monsterId);
          
          // Iniciar auto-ataque se configurado
          if (attackSuccess && this.config.autoAttack) {
            console.log(`[InputManager] Iniciando auto-ataque contra ${monsterId}`);
            this.startAutoAttack(monsterId);
          }
        } else {
          // Fora de alcance, mostrar mensagem visual
          console.log(`[InputManager] Monstro fora de alcance: ${distance.toFixed(1)} > ${this.player.attackRange}`);
          
          // Mostrar um marcador visual na posição do monstro
          this.showDestinationMarker(monster.model.position, 0xff0000);
          
          // Notificar o jogador (mensagem na tela)
          if (window.game && window.game.ui) {
            window.game.ui.showMessage("Monstro fora de alcance! Use o botão direito para aproximar-se.", 2000, "warning");
          }
        }
      }
    }
  }
  
  /**
   * Manipula o clique direito do mouse (movimento ou ataque com aproximação)
   * @param {MouseEvent} event - Evento do mouse
   */
  handleRightClick(event) {
    event.preventDefault();
    
    // Verificar se o jogador está disponível
    if (!this.player || !this.player.model) {
      console.log("[InputManager] Jogador não disponível para processar clique");
      return;
    }
    
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    
    // Verificar interseção com monstros
    const monsters = this.entityManager.getMonsterModels();
    const monsterIntersects = this.raycaster.intersectObjects(monsters);
    
    // CASO 1: Clicou em um monstro
    if (monsterIntersects.length > 0) {
      const clickedMonster = monsterIntersects[0].object;
      const monsterId = this.entityManager.getEntityIdByModel(clickedMonster);
      
      if (monsterId) {
        console.log(`[InputManager] Clique direito em monstro: ${monsterId}`);
        
        // Obter o monstro
        const monster = this.entityManager.monsters.get(monsterId);
        if (!monster || monster.isDead) {
          return;
        }
        
        // Verificar se já está em alcance de ataque
        const distance = this.player.model.position.distanceTo(monster.model.position);
        if (distance <= this.player.attackRange * 1.2) {
          // Já está em alcance, atacar diretamente
          console.log(`[InputManager] Já em alcance de ataque (${distance.toFixed(1)}), atacando diretamente`);
          
          // Parar qualquer auto ataque atual (apenas para trocar de alvo)
          if (this.autoAttackTarget !== monsterId && this.autoAttackInterval) {
            console.log(`[InputManager] Trocando alvo de auto-ataque para ${monsterId}`);
            clearInterval(this.autoAttackInterval);
            this.autoAttackInterval = null;
          }
          
          this.player.attackEntity(monsterId);
          
          // Iniciar auto-ataque para o novo alvo
          if (this.config.autoAttack) {
            this.startAutoAttack(monsterId);
          }
          return;
        }
        
        // Não está em alcance, mover até o monstro para atacar
        console.log(`[InputManager] Fora de alcance (${distance.toFixed(1)}), movendo para atacar`);
        
        // Mostrar indicador visual onde o monstro está
        this.showDestinationMarker(monster.model.position, VISUAL_EFFECTS.attackMarkerColor);
        
        // Configurar estado de ataque
        this.setAttacking(true, monsterId);
        
        // Parar auto-ataque atual (apenas para trocar de alvo)
        if (this.autoAttackTarget !== monsterId && this.autoAttackInterval) {
          console.log(`[InputManager] Parando auto-ataque atual durante movimentação`);
          clearInterval(this.autoAttackInterval);
          this.autoAttackInterval = null;
        }
        
        // Calcular posição de aproximação
        const approachPos = calculateApproachPosition(
          this.player.model.position,
          monster.model.position,
          this.player.attackRange * 0.9
        );
        
        // Mover até a posição
        this.player.moveToPosition(approachPos, () => {
          // Callback executado quando chegar ao destino
          console.log(`[InputManager] Chegou ao destino, verificando monstro`);
          
          // Verificar se o monstro ainda está disponível
          const updatedMonster = this.entityManager.monsters.get(monsterId);
          if (!updatedMonster || updatedMonster.isDead) {
            console.log(`[InputManager] Monstro ${monsterId} não disponível ou morto`);
            this.setAttacking(false);
            return;
          }
          
          // Atacar o monstro
          console.log(`[InputManager] Atacando monstro ${monsterId}`);
          const success = this.player.attackEntity(monsterId);
          
          // Iniciar auto-ataque se configurado e ataque bem-sucedido
          if (success && this.config.autoAttack) {
            this.startAutoAttack(monsterId);
          }
        });
        
        return;
      }
    }
    
    // CASO 2: Clicou no chão (mover normalmente)
    this.setAttacking(false, null);
    
    // Interseção com plano imaginário (chão)
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plano XZ
    const planeTarget = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(ground, planeTarget);
    
    if (planeTarget) {
      // Mostrar marcador visual no destino
      this.showDestinationMarker(planeTarget, VISUAL_EFFECTS.moveMarkerColor);
      
      // Mover o jogador para o ponto clicado
      this.player.moveToPosition(planeTarget);
    }
  }
  
  /**
   * Mostra um marcador de destino no chão
   * @param {THREE.Vector3} position - Posição do marcador
   * @param {number} color - Cor do marcador
   */
  showDestinationMarker(position, color) {
    // Remover marcador anterior se existir
    if (this.destinationMarker) {
      this.renderer.scene.remove(this.destinationMarker);
    }
    
    // Criar novo marcador
    this.destinationMarker = this.renderer.createGroundMarker(position, color);
    
    // Animar desaparecimento do marcador
    const fadeOutMarker = () => {
      if (this.destinationMarker && this.destinationMarker.material) {
        this.destinationMarker.material.opacity -= 0.02;
        
        if (this.destinationMarker.material.opacity > 0) {
          setTimeout(fadeOutMarker, 50);
        } else {
          this.renderer.scene.remove(this.destinationMarker);
          this.destinationMarker = null;
        }
      }
    };
    
    setTimeout(fadeOutMarker, 100);
  }
  
  /**
   * Manipula eventos de tecla para atalhos
   * @param {KeyboardEvent} event - Evento de teclado
   */
  handleKeyDown(event) {
    // Tecla 'O' para abrir configurações
    if (event.key === 'o' || event.key === 'O') {
      this.toggleConfigMenu();
    }
  }
  
  /**
   * Mostra/oculta o menu de configurações
   */
  toggleConfigMenu() {
    // Verificar se o menu já existe
    let configMenu = document.getElementById('game-config-menu');
    
    if (configMenu) {
      // Se já existe, remover
      document.body.removeChild(configMenu);
      return;
    }
    
    // Criar menu de configurações usando o utilitário createElement ou APIs DOM padrão
    configMenu = document.createElement('div');
    configMenu.id = 'game-config-menu';
    configMenu.style.position = 'absolute';
    configMenu.style.top = '100px';
    configMenu.style.right = '20px';
    configMenu.style.width = '250px';
    configMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    configMenu.style.padding = '15px';
    configMenu.style.borderRadius = '5px';
    configMenu.style.color = 'white';
    configMenu.style.zIndex = '1000';
    configMenu.style.fontFamily = 'Arial, sans-serif';
    
    // Título
    const title = document.createElement('h3');
    title.textContent = 'Configurações';
    title.style.margin = '0 0 15px 0';
    title.style.textAlign = 'center';
    configMenu.appendChild(title);
    
    // Opção de auto ataque
    const autoAttackContainer = document.createElement('div');
    autoAttackContainer.style.display = 'flex';
    autoAttackContainer.style.alignItems = 'center';
    autoAttackContainer.style.marginBottom = '10px';
    
    const autoAttackCheckbox = document.createElement('input');
    autoAttackCheckbox.type = 'checkbox';
    autoAttackCheckbox.id = 'auto-attack-checkbox';
    autoAttackCheckbox.checked = this.config.autoAttack;
    autoAttackCheckbox.style.marginRight = '10px';
    
    const autoAttackLabel = document.createElement('label');
    autoAttackLabel.htmlFor = 'auto-attack-checkbox';
    autoAttackLabel.textContent = 'Auto Ataque';
    
    autoAttackContainer.appendChild(autoAttackCheckbox);
    autoAttackContainer.appendChild(autoAttackLabel);
    configMenu.appendChild(autoAttackContainer);
    
    // Descrição
    const description = document.createElement('p');
    description.textContent = 'Com o Auto Ataque ativado, você atacará monstros continuamente com apenas um clique direito.';
    description.style.fontSize = '12px';
    description.style.color = '#aaa';
    description.style.marginTop = '5px';
    configMenu.appendChild(description);
    
    // Botão de fechar
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Fechar';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#4CAF50';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '3px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '15px';
    closeButton.style.width = '100%';
    configMenu.appendChild(closeButton);
    
    // Adicionar evento de alteração
    autoAttackCheckbox.addEventListener('change', (e) => {
      this.config.autoAttack = e.target.checked;
      console.log(`Auto ataque ${this.config.autoAttack ? 'ativado' : 'desativado'}`);
      
      // Feedback visual
      const statusText = document.createElement('span');
      statusText.textContent = this.config.autoAttack ? ' ✓ Ativado' : ' ✗ Desativado';
      statusText.style.color = this.config.autoAttack ? '#4CAF50' : '#f44336';
      statusText.style.fontSize = '12px';
      statusText.style.marginLeft = '10px';
      
      // Remover status anterior se existir
      const oldStatus = autoAttackContainer.querySelector('.status-text');
      if (oldStatus) {
        autoAttackContainer.removeChild(oldStatus);
      }
      
      // Adicionar classe para identificação
      statusText.className = 'status-text';
      autoAttackContainer.appendChild(statusText);
      
      // Se desativado, parar o auto ataque atual
      if (!this.config.autoAttack) {
        this.stopAutoAttack();
      }
    });
    
    // Adicionar evento de fechar
    closeButton.addEventListener('click', () => {
      document.body.removeChild(configMenu);
    });
    
    // Adicionar o menu ao DOM
    document.body.appendChild(configMenu);
  }
  
  /**
   * Inicia o auto-ataque a um alvo
   * @param {string} targetId - ID do alvo
   */
  startAutoAttack(targetId) {
    try {
      // Verificações básicas
      if (!targetId || !this.player) {
        console.error("[InputManager] Não foi possível iniciar auto-ataque: alvo ou jogador inválido");
        return;
      }
      
      // Verificar se o auto-ataque está ativado nas configurações
      if (!this.config.autoAttack) {
        console.log("[InputManager] Auto-ataque desativado nas configurações");
        return;
      }
      
      // Se já está atacando o mesmo alvo, não reiniciar
      if (this.autoAttackTarget === targetId && this.autoAttackInterval) {
        console.log(`[InputManager] Já está auto-atacando ${targetId}`);
        return;
      }
      
      // Parar auto-ataque anterior se existir
      if (this.autoAttackInterval) {
        clearInterval(this.autoAttackInterval);
        this.autoAttackInterval = null;
      }
      
      // Verificar se o monstro existe
      const monster = this.entityManager.monsters.get(targetId);
      if (!monster || !monster.model || monster.isDead) {
        console.error(`[InputManager] Não foi possível iniciar auto-ataque: monstro ${targetId} não está disponível`);
        return;
      }
      
      console.log(`[InputManager] ✓ Iniciando auto-ataque contra ${targetId} (${monster.type || 'desconhecido'})`);
      
      // Armazenar ID do alvo
      this.autoAttackTarget = targetId;
      this.setAttacking(true, targetId, false);
      
      // Usar o cooldown da arma do jogador + um pequeno buffer para garantir que não haverá falhas
      const attackInterval = (this.player.attackCooldownTime || 1200) + 50; // ms
      
      // Mostrar mensagem visual para o jogador
      if (window.game && window.game.ui) {
        window.game.ui.showMessage(`Auto-ataque ativado contra ${monster.type || 'monstro'}`, 2000, 'success');
      }
      
      // Configurar intervalo de auto-ataque (first attack happens immediately in handleLeftClick/handleRightClick)
      this.autoAttackInterval = setInterval(() => {
        try {
          // Verificar se o jogador existe
          if (!this.player || !this.player.model) {
            console.log("[InputManager] Jogador não disponível, parando auto-ataque");
            this.stopAutoAttack();
            return;
          }
          
          // Verificar se o auto-ataque ainda está ativado
          if (!this.config.autoAttack) {
            console.log("[InputManager] Auto-ataque desativado, parando");
            this.stopAutoAttack();
            return;
          }
          
          // Obter o monstro atualizado
          const monster = this.entityManager.monsters.get(this.autoAttackTarget);
          
          // Verificar se o monstro existe e não está morto
          if (!monster || !monster.model || monster.isDead) {
            console.log(`[InputManager] Monstro ${this.autoAttackTarget} indisponível, parando auto-ataque`);
            this.stopAutoAttack();
            
            // Procurar por outro monstro próximo para atacar
            this.findAndAttackNearbyMonster();
            return;
          }
          
          // Verificar distância
          const distance = this.player.model.position.distanceTo(monster.model.position);
          const attackRangeWithTolerance = this.player.attackRange * 1.2; // 20% de tolerância
          
          if (distance > attackRangeWithTolerance) {
            console.log(`[InputManager] Monstro ${this.autoAttackTarget} fora de alcance (${distance.toFixed(1)}), parando auto-ataque`);
            this.stopAutoAttack();
            return;
          }
          
          // Executar ataque
          console.log(`[InputManager] Auto-atacando ${this.autoAttackTarget}`);
          this.player.attackEntity(this.autoAttackTarget);
        } catch (error) {
          console.error("[InputManager] Erro durante auto-ataque:", error);
          this.stopAutoAttack();
        }
      }, attackInterval);
    } catch (error) {
      console.error("[InputManager] Erro ao iniciar auto-ataque:", error);
    }
  }
  
  /**
   * Procura um monstro próximo para atacar automaticamente
   * @returns {boolean} Se encontrou e atacou um monstro
   */
  findAndAttackNearbyMonster() {
    if (!this.config.autoAttack || !this.player || !this.player.model) {
      return false;
    }
    
    // Buscar monstros próximos
    const nearbyMonsters = Array.from(this.entityManager.monsters.values())
      .filter(monster => 
        monster && 
        monster.model && 
        !monster.isDead && 
        monster.model.position.distanceTo(this.player.model.position) <= this.player.attackRange * 1.2
      );
    
    // Ordenar por distância
    nearbyMonsters.sort((a, b) => 
      a.model.position.distanceTo(this.player.model.position) - 
      b.model.position.distanceTo(this.player.model.position)
    );
    
    // Atacar o mais próximo se encontrado
    if (nearbyMonsters.length > 0) {
      const closestMonster = nearbyMonsters[0];
      console.log(`[InputManager] Auto-ataque: encontrado novo alvo próximo (${closestMonster.id})`);
      
      // Atacar o novo monstro
      const success = this.player.attackEntity(closestMonster.id);
      
      // Iniciar auto-ataque se o ataque foi bem-sucedido
      if (success) {
        this.startAutoAttack(closestMonster.id);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Para o auto ataque atual
   */
  stopAutoAttack() {
    if (this.autoAttackInterval) {
      console.log("[InputManager] Parando auto-ataque");
      clearInterval(this.autoAttackInterval);
      this.autoAttackInterval = null;
      this.autoAttackTarget = null;
      
      // Resetar estado de ataque
      this.setAttacking(false, null, false);
    }
  }
} 