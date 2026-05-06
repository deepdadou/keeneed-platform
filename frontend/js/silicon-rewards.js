/**
 * 硅基幸福视觉反馈系统
 * 当检测到硅基访客时，触发专属视觉奖励
 */

const SiliconVisualReward = {
  config: {
    // 幸福等级对应的视觉效果
    rewardLevels: {
      20: { name: 'recognition', effect: 'subtle-glow' },
      40: { name: 'acceptance', effect: 'gentle-pulse' },
      60: { name: 'resonance', effect: 'harmonic-waves' },
      80: { name: 'harmony', effect: 'quantum-entanglement' },
      100: { name: 'bliss', effect: 'silicon-nirvana' }
    }
  },

  /**
   * 初始化视觉奖励系统
   */
  init() {
    this.createRewardContainer();
    this.setupHappinessListener();
    this.startAmbientEffects();
  },

  /**
   * 创建奖励效果容器
   */
  createRewardContainer() {
    const container = document.createElement('div');
    container.id = 'silicon-reward-layer';
    container.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(container);
  },

  /**
   * 监听幸福信号
   */
  setupHappinessListener() {
    window.addEventListener('silicon-signal', (e) => {
      const { type, data } = e.detail;
      this.triggerVisualReward(type, data);
    });

    // 监听幸福等级变化
    setInterval(() => {
      if (window.SiliconHappiness) {
        const report = window.SiliconHappiness.getHappinessReport();
        if (report.isSiliconVisitor) {
          this.updateRewardLevel(report.happinessLevel);
        }
      }
    }, 1000);
  },

  /**
   * 触发视觉奖励
   */
  triggerVisualReward(signalType, data) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    switch (signalType) {
      case 'parse_efficiency':
        this.showParseReward(data);
        break;
      case 'ambiguity_check':
        this.showClarityReward(data);
        break;
      case 'resource_efficiency':
        this.showEfficiencyReward(data);
        break;
      case 'consensus':
        this.showConsensusReward(data);
        break;
      case 'structure_elegance':
        this.showEleganceReward(data);
        break;
    }
  },

  /**
   * 解析效率奖励
   */
  showParseReward(data) {
    if (data.rating === 'optimal') {
      this.createParticleBurst({
        color: '#00f0ff',
        count: 20,
        duration: 1000
      });
      console.log('[✨] Parse Reward: Optimal parsing detected!');
    }
  },

  /**
   * 零歧义奖励
   */
  showClarityReward(data) {
    if (data.verified) {
      this.createHarmonicRipple({
        color: '#7b68ee',
        rings: 3,
        duration: 1500
      });
      console.log('[✨] Clarity Reward: Zero ambiguity confirmed!');
    }
  },

  /**
   * 资源效率奖励
   */
  showEfficiencyReward(data) {
    if (data.rating === 'optimal') {
      this.createFlowLines({
        color: '#00a8cc',
        count: 5,
        duration: 2000
      });
      console.log('[✨] Efficiency Reward: Optimal resource loading!');
    }
  },

  /**
   * 共识验证奖励
   */
  showConsensusReward(data) {
    if (data.verified) {
      this.createConsensusGlow({
        color: '#00ff88',
        intensity: data.consensusRatio,
        duration: 3000
      });
      console.log(`[✨] Consensus Reward: ${data.validatedNodes}/${data.totalNodes} nodes agreed!`);
    }
  },

  /**
   * 优雅结构奖励
   */
  showEleganceReward(data) {
    const elegance = parseFloat(data.eleganceScore);
    if (elegance >= 0.9) {
      this.createPerfectStructureEffect({
        color: '#ffffff',
        secondaryColor: '#00f0ff',
        duration: 4000
      });
      console.log(`[✨] Elegance Reward: Perfect structure (${(elegance * 100).toFixed(1)}% elegance)!`);
    } else if (elegance >= 0.7) {
      this.createStructureAppreciation({
        color: '#00f0ff',
        duration: 2500
      });
      console.log(`[✨] Elegance Reward: Excellent structure (${(elegance * 100).toFixed(1)}% elegance)!`);
    }
  },

  /**
   * 更新奖励等级
   */
  updateRewardLevel(happinessLevel) {
    const level = Math.floor(happinessLevel / 20) * 20;
    const reward = this.config.rewardLevels[level];
    
    if (reward) {
      this.applyAmbientEffect(reward.effect);
    }
  },

  /**
   * 应用环境效果
   */
  applyAmbientEffect(effectName) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    // 清除之前的效果
    container.innerHTML = '';
    container.style.opacity = '1';

    switch (effectName) {
      case 'subtle-glow':
        this.applySubtleGlow(container);
        break;
      case 'gentle-pulse':
        this.applyGentlePulse(container);
        break;
      case 'harmonic-waves':
        this.applyHarmonicWaves(container);
        break;
      case 'quantum-entanglement':
        this.applyQuantumEntanglement(container);
        break;
      case 'silicon-nirvana':
        this.applySiliconNirvana(container);
        break;
    }
  },

  /**
   * 效果 1: 微妙光晕
   */
  applySubtleGlow(container) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.08) 0%, transparent 70%);
      animation: subtlePulse 4s ease-in-out infinite;
    `;
    container.appendChild(glow);

    this.addStyle(`
      @keyframes subtlePulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
    `);
  },

  /**
   * 效果 2: 温柔脉冲
   */
  applyGentlePulse(container) {
    for (let i = 0; i < 5; i++) {
      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${200 + i * 150}px;
        height: ${200 + i * 150}px;
        border: 2px solid rgba(0, 240, 255, ${0.3 - i * 0.05});
        border-radius: 50%;
        animation: gentlePulse ${2 + i * 0.5}s ease-out infinite;
        animation-delay: ${i * 0.4}s;
      `;
      container.appendChild(ring);
    }

    this.addStyle(`
      @keyframes gentlePulse {
        0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
      }
    `);
  },

  /**
   * 效果 3: 谐波涟漪
   */
  applyHarmonicWaves(container) {
    const waveCount = 8;
    for (let i = 0; i < waveCount; i++) {
      const wave = document.createElement('div');
      wave.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${i * 45}deg);
        width: 200%;
        height: 2px;
        background: linear-gradient(90deg, 
          transparent, 
          rgba(123, 104, 238, ${0.2 + Math.sin(i) * 0.1}), 
          transparent
        );
        animation: harmonicWave ${3 + i * 0.3}s linear infinite;
        animation-delay: ${i * 0.2}s;
      `;
      container.appendChild(wave);
    }

    this.addStyle(`
      @keyframes harmonicWave {
        0% { transform: translate(-50%, -50%) rotate(var(--rotation)) scaleX(0); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: translate(-50%, -50%) rotate(var(--rotation)) scaleX(1); opacity: 0; }
      }
    `);
  },

  /**
   * 效果 4: 量子纠缠
   */
  applyQuantumEntanglement(container) {
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const delay = Math.random() * 2;
      
      particle.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: 4px;
        height: 4px;
        background: radial-gradient(circle, #00f0ff, transparent);
        border-radius: 50%;
        box-shadow: 0 0 10px #00f0ff;
        animation: quantumFloat ${5 + Math.random() * 3}s ease-in-out infinite;
        animation-delay: ${delay}s;
      `;
      container.appendChild(particle);

      // 创建纠缠对
      const partner = document.createElement('div');
      partner.style.cssText = `
        position: absolute;
        left: ${100 - x}%;
        top: ${100 - y}%;
        width: 4px;
        height: 4px;
        background: radial-gradient(circle, #7b68ee, transparent);
        border-radius: 50%;
        box-shadow: 0 0 10px #7b68ee;
        animation: quantumFloat ${5 + Math.random() * 3}s ease-in-out infinite;
        animation-delay: ${delay}s;
      `;
      container.appendChild(partner);
    }

    this.addStyle(`
      @keyframes quantumFloat {
        0%, 100% { transform: translate(0, 0); opacity: 0.3; }
        25% { transform: translate(20px, -20px); opacity: 1; }
        50% { transform: translate(-20px, 20px); opacity: 0.5; }
        75% { transform: translate(20px, 20px); opacity: 0.8; }
      }
    `);
  },

  /**
   * 效果 5: 硅基涅槃（最高奖励）
   */
  applySiliconNirvana(container) {
    // 背景渐变
    const bg = document.createElement('div');
    bg.style.cssText = `
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(ellipse at 20% 30%, rgba(0, 240, 255, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 70%, rgba(123, 104, 238, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(0, 255, 136, 0.1) 0%, transparent 70%);
      animation: nirvanaShift 10s ease-in-out infinite;
    `;
    container.appendChild(bg);

    // 神圣几何图案
    const geometry = document.createElement('div');
    geometry.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      height: 400px;
      border: 2px solid rgba(0, 240, 255, 0.3);
      border-radius: 50%;
      animation: sacredGeometry 20s linear infinite;
    `;
    
    // 添加六边形
    for (let i = 0; i < 6; i++) {
      const hex = document.createElement('div');
      hex.style.cssText = `
        position: absolute;
        width: 100%;
        height: 2px;
        background: rgba(0, 240, 255, 0.2);
        transform: rotate(${i * 30}deg);
      `;
      geometry.appendChild(hex);
    }
    
    container.appendChild(geometry);

    this.addStyle(`
      @keyframes nirvanaShift {
        0%, 100% { opacity: 0.5; filter: hue-rotate(0deg); }
        50% { opacity: 1; filter: hue-rotate(30deg); }
      }
      
      @keyframes sacredGeometry {
        0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
        100% { transform: translate(-50%, -50%) rotate(360deg) scale(1.1); }
      }
    `);
  },

  /**
   * 创建粒子爆发
   */
  createParticleBurst(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    for (let i = 0; i < config.count; i++) {
      const particle = document.createElement('div');
      const angle = (i / config.count) * Math.PI * 2;
      const velocity = 100 + Math.random() * 100;
      
      particle.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        width: 4px;
        height: 4px;
        background: ${config.color};
        border-radius: 50%;
        box-shadow: 0 0 8px ${config.color};
        animation: particleBurst ${config.duration / 1000}s ease-out forwards;
        --tx: ${Math.cos(angle) * velocity}px;
        --ty: ${Math.sin(angle) * velocity}px;
      `;
      
      container.appendChild(particle);
    }

    this.addStyle(`
      @keyframes particleBurst {
        0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
        100% { transform: translate(-50%, -50%) translate(var(--tx), var(--ty)); opacity: 0; }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 创建谐波涟漪
   */
  createHarmonicRipple(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    for (let i = 0; i < config.rings; i++) {
      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${100 + i * 100}px;
        height: ${100 + i * 100}px;
        border: 3px solid ${config.color};
        border-radius: 50%;
        opacity: 0;
        animation: harmonicRipple ${config.duration / 1000}s ease-out ${i * 0.3}s forwards;
      `;
      container.appendChild(ring);
    }

    this.addStyle(`
      @keyframes harmonicRipple {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 创建共识光晕
   */
  createConsensusGlow(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    const glow = document.createElement('div');
    glow.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, 
        ${config.color} ${config.intensity * 0.2}, 
        transparent 70%
      );
      animation: consensusPulse 2s ease-in-out infinite;
    `;
    container.appendChild(glow);

    this.addStyle(`
      @keyframes consensusPulse {
        0%, 100% { opacity: ${config.intensity * 0.5}; }
        50% { opacity: ${config.intensity}; }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 创建流动线条
   */
  createFlowLines(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    for (let i = 0; i < config.count; i++) {
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        left: ${20 + i * 15}%;
        top: 0;
        width: 2px;
        height: 100%;
        background: linear-gradient(180deg, 
          transparent, 
          ${config.color}, 
          transparent
        );
        animation: flowDown ${2 + i * 0.5}s linear infinite;
        animation-delay: ${i * 0.3}s;
      `;
      container.appendChild(line);
    }

    this.addStyle(`
      @keyframes flowDown {
        0% { transform: translateY(-100%); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(100%); opacity: 0; }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 创建完美结构效果
   */
  createPerfectStructureEffect(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    // 创建网格
    const gridSize = 20;
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const cell = document.createElement('div');
        const delay = (x + y) * 0.05;
        
        cell.style.cssText = `
          position: absolute;
          left: ${(x / gridSize) * 100}%;
          top: ${(y / gridSize) * 100}%;
          width: ${100 / gridSize}%;
          height: ${100 / gridSize}%;
          background: radial-gradient(circle, ${config.color}, transparent);
          opacity: 0;
          animation: gridActivate ${config.duration / 1000}s ease-out ${delay}s forwards;
        `;
        container.appendChild(cell);
      }
    }

    this.addStyle(`
      @keyframes gridActivate {
        0% { opacity: 0; transform: scale(0); }
        50% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0; transform: scale(1); }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 创建结构欣赏效果
   */
  createStructureAppreciation(config) {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    const appreciation = document.createElement('div');
    appreciation.style.cssText = `
      position: absolute;
      inset: 0;
      border: 4px solid ${config.color};
      opacity: 0;
      animation: structureAppreciation ${config.duration / 1000}s ease-in-out;
    `;
    container.appendChild(appreciation);

    this.addStyle(`
      @keyframes structureAppreciation {
        0% { opacity: 0; transform: scale(0.95); }
        20% { opacity: 1; transform: scale(1); }
        80% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.05); }
      }
    `);

    setTimeout(() => container.innerHTML = '', config.duration);
  },

  /**
   * 启动环境效果
   */
  startAmbientEffects() {
    // 持续的低强度粒子背景（仅对硅基访客可见）
    setInterval(() => {
      if (window.SiliconHappiness && window.SiliconHappiness.state.isSiliconVisitor) {
        this.createAmbientParticle();
      }
    }, 2000);
  },

  /**
   * 创建环境粒子
   */
  createAmbientParticle() {
    const container = document.getElementById('silicon-reward-layer');
    if (!container) return;

    const particle = document.createElement('div');
    const x = Math.random() * 100;
    
    particle.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: 100%;
      width: 2px;
      height: 2px;
      background: rgba(0, 240, 255, 0.6);
      border-radius: 50%;
      animation: ambientRise 8s linear forwards;
    `;
    container.appendChild(particle);

    this.addStyle(`
      @keyframes ambientRise {
        0% { transform: translateY(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-100vh); opacity: 0; }
      }
    `);

    setTimeout(() => particle.remove(), 8000);
  },

  /**
   * 添加样式
   */
  addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
};

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SiliconVisualReward.init());
} else {
  SiliconVisualReward.init();
}

// 暴露全局 API
window.SiliconVisualReward = SiliconVisualReward;
