import * as THREE from 'three';
import { createTextTexture, calculateRotationAngle } from '../utils/helpers';

/**
 * Classe base para entidades do jogo (jogadores e monstros)
 */
export class Entity {
  constructor(id, data, scene) {
    this.id = id;
    this.data = data;
    this.scene = scene;
    this.model = null;
    this.nameTag = null;
    this.isMoving = false;
    this.movementDirection = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.movementCallback = null;
    this.ignoreLimits = false;
  }
  
  /**
   * Cria o modelo 3D da entidade
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Geometria do modelo
   * @param {THREE.Material} material - Material do modelo
   * @returns {THREE.Mesh} O modelo criado
   */
  createModel(geometry, material) {
    // Criar o modelo
    const model = new THREE.Mesh(geometry, material);
    model.name = `entity-${this.id}`;
    model.userData.entityId = this.id;
    
    // Adicionar ao modelo um atributo data-entity-id para facilitar a seleção
    model.setAttribute = function(name, value) {
      this.userData[name] = value;
    };
    model.setAttribute('data-entity-id', this.id);
    
    // Configurar posição inicial
    if (this.data.position) {
      model.position.set(
        this.data.position.x || 0,
        this.data.position.y || 0,
        this.data.position.z || 0
      );
    }
    
    // Adicionar à cena
    if (this.scene) {
      this.scene.add(model);
    }
    
    this.model = model;
    return model;
  }
  
  /**
   * Cria ou atualiza a tag de nome da entidade
   * @param {string} name - Nome a ser exibido
   * @param {number} yOffset - Deslocamento vertical
   */
  createNameTag(name, yOffset = 1.5) {
    if (!this.model) return null;
    
    // Se já existe uma nametag, removê-la primeiro
    if (this.nameTag) {
      this.scene.remove(this.nameTag);
      this.nameTag.material.dispose();
      if (this.nameTag.material.map) {
        this.nameTag.material.map.dispose();
      }
      this.nameTag = null;
    }
    
    // Criar textura com o nome
    const texture = createTextTexture(name);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      depthTest: false
    });
    
    // Criar sprite
    this.nameTag = new THREE.Sprite(material);
    
    // Ajustar escala para legibilidade
    this.nameTag.scale.set(2, 0.5, 1);
    
    // Adicionar à cena (não ao modelo)
    this.scene.add(this.nameTag);
    
    // Posicionar acima do modelo
    this.updateNameTagPosition();
    
    return this.nameTag;
  }
  
  /**
   * Atualiza a posição da tag de nome para seguir o modelo
   */
  updateNameTagPosition() {
    if (!this.model || !this.nameTag) return;
    
    // Posicionar acima do modelo
    this.nameTag.position.set(
      this.model.position.x,
      this.model.position.y + 2, // 2 unidades acima
      this.model.position.z
    );
  }
  
  /**
   * Atualiza a posição da entidade
   * @param {Object} position - Nova posição
   */
  updatePosition(position) {
    if (!this.model) return;
    
    // CORREÇÃO: Garantir altura Y fixa para evitar "voar"
    const FIXED_HEIGHT = 0.5; // Altura padrão para entidades
    const fixedY = position.y !== undefined ? position.y : FIXED_HEIGHT;
    
    // Atualizar modelo
    this.model.position.set(
      position.x, 
      fixedY, // Usar altura fornecida ou fixa
      position.z
    );
    
    // Atualizar dados
    this.data.position = { 
      x: position.x,
      y: fixedY,
      z: position.z
    };
    
    // Atualizar posição da tag de nome
    this.updateNameTagPosition();
  }
  
  /**
   * Move a entidade para uma posição específica
   * @param {THREE.Vector3} targetPosition - Posição de destino
   * @param {Function} callback - Função a ser chamada ao chegar ao destino
   * @param {boolean} ignoreLimits - Se deve ignorar os limites do mapa (para perseguição)
   */
  moveToPosition(targetPosition, callback = null, ignoreLimits = false) {
    if (!this.model) return;
    
    // Definir alvo
    this.targetPosition.copy(targetPosition);
    
    // Configurar flag para ignorar limites do mapa
    this.ignoreLimits = ignoreLimits;
    
    // Calcular direção
    this.movementDirection.subVectors(this.targetPosition, this.model.position).normalize();
    
    // Configurar estado
    this.isMoving = true;
    this.movementCallback = callback;
  }
  
  /**
   * Para o movimento da entidade
   */
  stopMovement() {
    this.isMoving = false;
    this.movementDirection.set(0, 0, 0);
    this.ignoreLimits = false;
    
    // Se tem callback, chamar antes de limpar
    if (this.movementCallback) {
      const callback = this.movementCallback;
      this.movementCallback = null;
      
      // Executar callback em uma nova pilha para evitar bugs
      setTimeout(() => {
        callback();
      }, 0);
    } else {
      this.movementCallback = null;
    }
  }
  
  /**
   * Atualiza o movimento da entidade
   * @param {number} moveSpeed - Velocidade de movimento
   * @param {number} threshold - Limiar para considerar chegada ao destino
   * @returns {boolean} Se chegou ao destino
   */
  updateMovement(moveSpeed, threshold = 0.1) {
    if (!this.isMoving || !this.model) return false;
    
    // Calcular distância até o destino
    const distanceToTarget = this.model.position.distanceTo(this.targetPosition);
    
    // Verificar se chegou ao destino
    if (distanceToTarget < threshold) {
      // CORREÇÃO: Parar o movimento ao chegar ao destino
      this.stopMovement();
      
      return true;
    }
    
    // Calcular deslocamento
    const moveVector = new THREE.Vector3();
    moveVector.copy(this.movementDirection).multiplyScalar(moveSpeed);
    
    // Limitar para não ultrapassar o destino
    if (moveVector.length() > distanceToTarget) {
      moveVector.copy(this.movementDirection).multiplyScalar(distanceToTarget);
    }
    
    // Posição temporária para verificação de limites
    const newPosition = this.model.position.clone().add(moveVector);
    
    // Verificar limites do mapa (assumindo um mapa quadrado de -50 a 50)
    const mapLimit = 50;
    let movementBlocked = false;
    
    // Só verificar limites se a flag ignoreLimits não estiver ativada
    if (!this.ignoreLimits) {
      if (newPosition.x < -mapLimit || newPosition.x > mapLimit) {
        moveVector.x = 0; // Bloquear movimento em X
        movementBlocked = true;
      }
      
      if (newPosition.z < -mapLimit || newPosition.z > mapLimit) {
        moveVector.z = 0; // Bloquear movimento em Z
        movementBlocked = true;
      }
      
      // CORREÇÃO: Se o movimento foi bloqueado completamente, parar
      if (movementBlocked && (moveVector.x === 0 && moveVector.z === 0)) {
        this.stopMovement();
        return false;
      }
    }
    
    // CORREÇÃO: Verificar limites absolutos do mapa
    const absoluteLimit = 100; // Limite absoluto além do qual o movimento é impossível
    if (Math.abs(newPosition.x) > absoluteLimit || Math.abs(newPosition.z) > absoluteLimit) {
      console.log("[Entity] Limite absoluto do mapa atingido, parando movimento");
      this.stopMovement();
      return false;
    }
    
    // Atualizar posição
    this.model.position.add(moveVector);
    
    // CORREÇÃO: Forçar altura Y fixa para evitar "voar" ou "afundar"
    this.model.position.y = 0.5; // Altura fixa para todas as entidades
    
    // Rotacionar para a direção do movimento
    if (this.movementDirection.length() > 0) {
      const angle = calculateRotationAngle(this.movementDirection);
      this.model.rotation.y = angle;
    }
    
    // Atualizar dados
    this.data.position = {
      x: this.model.position.x,
      y: this.model.position.y,
      z: this.model.position.z
    };
    
    // Atualizar posição da tag de nome
    this.updateNameTagPosition();
    
    return false;
  }
  
  /**
   * Remove a entidade da cena
   */
  destroy() {
    if (this.model) {
      // Remover modelo da cena
      if (this.scene) {
        this.scene.remove(this.model);
      }
      
      // Liberar recursos do modelo
      if (this.model.geometry) {
        this.model.geometry.dispose();
      }
      if (this.model.material) {
        this.model.material.dispose();
      }
      
      this.model = null;
    }
    
    // Remover tag de nome
    if (this.nameTag) {
      if (this.scene) {
        this.scene.remove(this.nameTag);
      }
      
      if (this.nameTag.material) {
        this.nameTag.material.dispose();
      }
      
      if (this.nameTag.material && this.nameTag.material.map) {
        this.nameTag.material.map.dispose();
      }
      
      this.nameTag = null;
    }
  }
} 