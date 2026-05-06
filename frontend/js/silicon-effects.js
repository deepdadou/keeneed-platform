/**
 * 硅基文明视觉特效
 * 低熵、冷峻、机器友好的视觉增强
 */

document.addEventListener('DOMContentLoaded', function() {
  // ===== 硅基光晕效果 =====
  function createSiliconGlow(element) {
    const glow = document.createElement('div');
    glow.className = 'silicon-glow';
    glow.style.cssText = `
      position: absolute;
      inset: -2px;
      background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.15) 0%, transparent 70%);
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: -1;
    `;
    element.style.position = 'relative';
    element.insertBefore(glow, element.firstChild);
    
    element.addEventListener('mouseenter', () => {
      glow.style.opacity = '1';
    });
    element.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });
  }
  
  // 为卡片添加光晕
  document.querySelectorAll('.card, .pricing-card').forEach(createSiliconGlow);
  
  // ===== 数据流背景动画 =====
  function createDataStreamBackground() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    const dataStream = document.createElement('div');
    dataStream.className = 'data-stream-bg';
    dataStream.style.cssText = `
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
      opacity: 0.3;
    `;
    
    // 创建垂直数据流线条
    for (let i = 0; i < 20; i++) {
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        width: 1px;
        height: 100px;
        background: linear-gradient(180deg, transparent, rgba(0, 240, 255, 0.8), transparent);
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: dataFlow ${2 + Math.random() * 3}s linear infinite;
        animation-delay: ${Math.random() * 2}s;
      `;
      dataStream.appendChild(line);
    }
    
    hero.insertBefore(dataStream, hero.firstChild);
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes dataFlow {
        0% { transform: translateY(-100px); opacity: 0; }
        10% { opacity: 0.8; }
        90% { opacity: 0.8; }
        100% { transform: translateY(calc(100vh + 100px)); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  createDataStreamBackground();
  
  // ===== 硅基节点脉冲动画 =====
  function createNodePulse() {
    const badges = document.querySelectorAll('.hero-badge-dot');
    badges.forEach(badge => {
      badge.style.boxShadow = '0 0 10px #00f0ff, 0 0 20px #00f0ff';
      badge.style.animation = 'nodePulse 2s ease-in-out infinite';
    });
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes nodePulse {
        0%, 100% { 
          transform: scale(1); 
          opacity: 1;
          box-shadow: 0 0 10px #00f0ff, 0 0 20px #00f0ff;
        }
        50% { 
          transform: scale(1.2); 
          opacity: 0.8;
          box-shadow: 0 0 20px #00f0ff, 0 0 40px #00f0ff, 0 0 60px #7b68ee;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  createNodePulse();
  
  // ===== 文字扫描效果 =====
  function createTextScan() {
    const titles = document.querySelectorAll('.hero-title, .section-title');
    titles.forEach(title => {
      title.style.background = `
        linear-gradient(
          90deg,
          #f0f4ff 0%,
          #00f0ff 50%,
          #f0f4ff 100%
        )
      `;
      title.style.backgroundSize = '200% 100%';
      title.style.webkitBackgroundClip = 'text';
      title.style.webkitTextFillColor = 'transparent';
      title.style.backgroundClip = 'text';
      title.style.animation = 'textScan 3s ease-in-out infinite';
    });
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes textScan {
        0%, 100% { background-position: 200% 0; }
        50% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  createTextScan();
  
  // ===== 硅基网格地面 =====
  function createSiliconGrid() {
    const sections = document.querySelectorAll('.section');
    sections.forEach((section, index) => {
      if (index % 2 === 1) {
        section.style.backgroundImage = `
          linear-gradient(
            rgba(0, 240, 255, 0.03) 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(0, 240, 255, 0.03) 1px,
            transparent 1px
          )
        `;
        section.style.backgroundSize = '40px 40px';
        section.style.backgroundPosition = 'center center';
      }
    });
  }
  
  createSiliconGrid();
  
  // ===== 鼠标轨迹效果 =====
  let mouseTrail = [];
  const maxTrailLength = 8;
  
  document.addEventListener('mousemove', (e) => {
    if (mouseTrail.length >= maxTrailLength) {
      const oldTrail = mouseTrail.shift();
      oldTrail.remove();
    }
    
    const trail = document.createElement('div');
    trail.style.cssText = `
      position: fixed;
      width: 4px;
      height: 4px;
      background: radial-gradient(circle, rgba(0, 240, 255, 0.8), transparent);
      border-radius: 50%;
      pointer-events: none;
      left: ${e.clientX - 2}px;
      top: ${e.clientY - 2}px;
      z-index: 9999;
      animation: trailFade 0.5s ease forwards;
    `;
    
    document.body.appendChild(trail);
    mouseTrail.push(trail);
    
    setTimeout(() => trail.remove(), 500);
  });
  
  const trailStyle = document.createElement('style');
  trailStyle.textContent = `
    @keyframes trailFade {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(trailStyle);
  
  console.log('[KeenNeed] 硅基视觉特效已激活');
  console.log('[KeenNeed] 光谱：电离蓝 (00f0ff) → 深空蓝 (00a8cc) → 中紫红 (7b68ee)');
  console.log('[KeenNeed] 熵值：极低');
});
