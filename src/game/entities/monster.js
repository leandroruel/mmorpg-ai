import * as THREE from 'three';
import { Entity } from './entity';
import { createTextTexture } from '../utils/helpers';

/**
 * Classe que representa um monstro no jogo
 */
export class Monster extends Entity {
  constructor(id, data, scene) {
    super(id, data, scene);
    
    this.hp = data.hp || 100;
    this.maxHp = data.maxHp || 100;
    this.type = data.type || 'unknown';
    this.isDead = false;
  }
  
  /**
   * Cria o modelo 3D do monstro
   */
  createMonsterModel() {
    // Criar geometria e material
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    
    // Criar modelo usando o método da classe pai
    this.createModel(geometry, material);
    
    // Adicionar atributo para facilitar a seleção
    if (this.model) {
      this.model.userData.entityId = this.id;
      this.model.userData.entityType = 'monster';
    }
    
    // Adicionar nome com tipo
    const displayName = `${this.type} (HP: ${this.hp}/${this.maxHp})`;
    this.createNameTag(displayName);
    
    return this.model;
  }
  
  /**
   * Atualiza o status do monstro
   */
  update() {
    // Atualizar movimento se estiver se movendo
    if (this.isMoving) {
      this.updateMovement(0.03); // Velocidade padrão de monstros
    }
  }
  
  /**
   * Aplica dano ao monstro
   * @param {number} damage - Quantidade de dano
   * @returns {number} HP restante
   */
  takeDamage(damage) {
    // Atualizar HP
    this.hp = Math.max(0, this.hp - damage);
    
    // Atualizar dados
    this.data.hp = this.hp;
    
    // Verificar se morreu
    if (this.hp <= 0 && !this.isDead) {
      this.die();
    }
    
    // Efeito visual de dano
    this.showDamageEffect(damage);
    
    // Atualizar nome com HP
    if (this.nameSprite) {
      const displayName = `${this.type} (HP: ${this.hp}/${this.maxHp})`;
      this.updateNameTag(displayName);
    }
    
    return this.hp;
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
   * Processa a morte do monstro
   */
  die() {
    if (!this.model) return;
    
    this.isDead = true;
    this.model.visible = false;
    
    console.log(`Monstro ${this.id} morreu!`);
  }
  
  /**
   * Respawna o monstro
   */
  respawn() {
    if (!this.model) return;
    
    // Resetar HP
    this.hp = this.maxHp;
    this.data.hp = this.maxHp;
    this.isDead = false;
    
    // Mostrar modelo
    this.model.visible = true;
    
    // Atualizar nome
    if (this.nameSprite) {
      const displayName = `${this.type} (HP: ${this.hp}/${this.maxHp})`;
      this.updateNameTag(displayName);
    }
    
    console.log(`Monstro ${this.id} respawnou!`);
  }
} 