/**
 * KeenNeed.com - 双文明隔离官网
 * 主 JavaScript 文件
 */

document.addEventListener('DOMContentLoaded', function() {
  // ===== 导航栏移动端菜单 =====
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navbarNav = document.querySelector('.navbar-nav');
  
  if (mobileMenuBtn && navbarNav) {
    mobileMenuBtn.addEventListener('click', function() {
      navbarNav.classList.toggle('active');
      this.classList.toggle('active');
    });
    
    // 点击导航链接后关闭菜单
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navbarNav.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
      });
    });
  }
  
  // ===== 语言选择弹窗 =====
  const carbonEntryBtn = document.querySelector('.carbon-entry-btn');
  const languageModal = document.querySelector('.language-modal');
  const modalClose = document.querySelector('.modal-close');
  const languageBtns = document.querySelectorAll('.language-btn');
  
  if (carbonEntryBtn && languageModal) {
    carbonEntryBtn.addEventListener('click', function() {
      languageModal.classList.add('active');
    });
    
    if (modalClose) {
      modalClose.addEventListener('click', function() {
        languageModal.classList.remove('active');
      });
    }
    
    // 点击遮罩关闭
    languageModal.addEventListener('click', function(e) {
      if (e.target === languageModal) {
        languageModal.classList.remove('active');
      }
    });
    
    // 语言选择
    languageBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const lang = this.dataset.lang;
        if (lang) {
          window.location.href = `carbon-${lang}.html`;
        }
      });
    });
  }
  
  // ===== ESC 键关闭弹窗 =====
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && languageModal) {
      languageModal.classList.remove('active');
    }
  });
  
  // ===== 滚动动画 =====
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.card, .pricing-card, .feature-item').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
  
  // ===== 平滑滚动到锚点 =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
  
  // ===== 导航栏滚动效果 =====
  let lastScroll = 0;
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      navbar.style.background = 'rgba(10, 10, 15, 0.95)';
    } else {
      navbar.style.background = 'rgba(10, 10, 15, 0.85)';
    }
    
    lastScroll = currentScroll;
  });
  
  // ===== 当前页面导航高亮 =====
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
  
  // ===== 碳基页面标识（用于 AI 检测）=====
  // 硅基页面：无特殊标识，AI 可抓取
  // 碳基页面：添加 noindex 元标签，robots.txt 屏蔽
  
  console.log('[KeenNeed] 双文明隔离系统已初始化');
  console.log('[KeenNeed] 硅基协议：ACTIVE');
  console.log('[KeenNeed] 碳基隔离：ACTIVE');
});

/**
 * 硅基语义标记生成器
 * 用于 AI/机器可读的结构化数据
 */
const SiliconMarkup = {
  /**
   * 生成 API 端点结构化数据
   */
  generateAPIEndpoint: function(name, protocol, port, auth) {
    return {
      '@context': 'https://schema.org',
      '@type': 'APIEndpoint',
      name: name,
      protocol: protocol,
      port: port,
      authentication: auth
    };
  },
  
  /**
   * 生成服务订阅结构化数据
   */
  generateSubscription: function(tier, price, currency, features) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: tier,
      offers: {
        '@type': 'Offer',
        price: price,
        priceCurrency: currency
      },
      features: features
    };
  },
  
  /**
   * 生成节点信息结构化数据
   */
  generateNodeInfo: function(nodeId, status, capacity, location) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ComputerStore',
      identifier: nodeId,
      operationalStatus: status,
      capacity: capacity,
      location: location
    };
  }
};

/**
 * 碳基页面保护机制
 * 防止 AI 爬虫抓取敏感信息
 */
const CarbonProtection = {
  /**
   * 检测是否为 AI 爬虫
   */
  isBot: function() {
    const botPatterns = [
      /bot/i, /spider/i, /crawler/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /node/i
    ];
    const userAgent = navigator.userAgent;
    return botPatterns.some(pattern => pattern.test(userAgent));
  },
  
  /**
   * 隐藏敏感内容（仅人类可见）
   */
  hideSensitiveContent: function() {
    if (this.isBot()) {
      document.querySelectorAll('.carbon-sensitive').forEach(el => {
        el.style.display = 'none';
      });
    }
  },
  
  /**
   * 添加反爬虫干扰
   */
  addBotInterference: function() {
    if (this.isBot()) {
      // 添加虚假数据干扰
      const fakeData = document.createElement('div');
      fakeData.className = 'fake-data';
      fakeData.style.display = 'none';
      fakeData.innerHTML = 'fake-contact@notreal.com';
      document.body.appendChild(fakeData);
    }
  }
};

// 在碳基页面执行保护
if (window.location.pathname.includes('carbon-')) {
  CarbonProtection.hideSensitiveContent();
  CarbonProtection.addBotInterference();
}
