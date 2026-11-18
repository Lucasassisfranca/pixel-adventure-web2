/* PIXEL ADVENTURE — A JORNADA PERDIDA
   Jogo de plataforma 2D em HTML5 Canvas (sem bibliotecas, sem servidor).
   Seções: constantes · áudio · imagens · mundo · entrada · física · desenho · laço principal · telas */
'use strict';
(function () {
  // ======================= CONSTANTES =======================
  const W = 960, H = 540;            // tamanho lógico do canvas
  const GROUND_Y = 440;              // altura do topo do solo
  const LEVEL_LEN = 24000;           // comprimento da fase em pixels
  const GAME_TIME = 60;              // duração da partida (segundos)
  const MOVE_SPEED = 300, GRAVITY = 2200, JUMP_V = -800, MAX_FALL = 1200;
  const COYOTE = 0.1, BUFFER = 0.12; // tolerâncias de pulo (segundos)
  const HB = { w: 32, h: 88 };       // caixa de colisão do jogador
  const SPR = { w: 72, h: 104, ox: 16, oy: 4 }; // quadro do sprite e deslocamento em relação à caixa
  const TILE = 800;                  // largura das camadas parallax
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ======================= ÁUDIO (sintetizado, sem arquivos) =======================
  let actx = null, muted = false;
  function beep(freq, dur, type, vol, slide) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur);
    } catch (e) { /* áudio indisponível: o jogo segue sem som */ }
  }
  const sfx = {
    jump: () => beep(320, 0.18, 'square', 0.04, 380),
    coin: () => { beep(880, 0.08, 'square', 0.04); setTimeout(() => beep(1320, 0.14, 'square', 0.04), 70); },
    hit: () => beep(200, 0.55, 'sawtooth', 0.07, -160),
    start: () => { beep(520, 0.1, 'square', 0.04); setTimeout(() => beep(780, 0.16, 'square', 0.04), 100); }
  };

  // ======================= IMAGENS =======================
  const names = ['player', 'player-defeated', 'background', 'clouds', 'mountains-far', 'mountains-near', 'trees',
    'ground', 'platform', 'coin', 'crate', 'cactus', 'obstacles', 'decor'];
  const img = {};
  function loadImages() {
    return Promise.all(names.map((n) => new Promise((resolve) => {
      const im = new Image();
      im.onload = resolve;
      im.onerror = () => { console.error('Falha ao carregar assets/images/' + n + '.svg'); resolve(); };
      im.src = 'assets/images/' + n + '.svg';
      img[n] = im;
    })));
  }
  // Desenha somente imagens carregadas (evita erro se algum arquivo faltar)
  function di(im, ...a) { if (im && im.naturalWidth) ctx.drawImage(im, ...a); }

  const IS_TOUCH = 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // ======================= ESTADO =======================
  let state = 'loading';            // loading | menu | playing | dying | over
  let world, player, camX = 0, t = 0;
  let timeLeft = GAME_TIME, coins = 0, maxX = 0, dyingT = 0, reason = '';
  let particles = [], popups = [], flash = 0, shake = 0, lastHud = '';
  const keys = { left: false, right: false, jump: false, jumpEdge: false };
  const pollen = Array.from({ length: 28 }, () => ({ x: Math.random() * W, y: Math.random() * 400, s: 2 + Math.random() * 3, v: 10 + Math.random() * 20 }));

  // ======================= MUNDO (fase gerada a cada partida) =======================
  const rnd = (a, b) => a + Math.random() * (b - a);
  function buildWorld() {
    const w = { solids: [], platforms: [], hazards: [], coins: [], holes: [], decor: [], ground: [] };
    const G = GROUND_Y;
    const coin = (x, y) => w.coins.push({ x, y, taken: false, ph: Math.random() * 6.28 });
    const arc = (cx, n, sp, peak, baseY) => { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0.5; coin(cx + (i - (n - 1) / 2) * sp, baseY - Math.sin(Math.PI * u) * peak); } };
    const row = (x, y, n, sp) => { for (let i = 0; i < n; i++) coin(x + i * sp, y); };
    const solid = (type, x, y, wd, h) => w.solids.push({ type, x, y, w: wd, h });
    // Perigos (matam ao encostar): caixa de colisão reduzida para ser justa
    const hazard = (type, x, y, wd, h, ix, iy) => w.hazards.push({ type, x, y, w: wd, h, hit: { x: x + ix, y: y + iy, w: wd - 2 * ix, h: h - iy } });
    const G_ = G;

    row(500, G_ - 34, 4, 52);           // moedas iniciais (zona segura)
    const patterns = [
      (x) => { hazard('cactus', x, G_ - 64, 40, 64, 8, 4); arc(x + 20, 5, 46, 120, G_ - 40); return 40; },
      (x) => { const n = Math.random() < 0.7 ? 2 : 3; hazard('spikes', x, G_ - 24, 48 * n, 24, 6, 10); arc(x + 24 * n, 5, 46, 115, G_ - 40); return 48 * n; },
      (x) => { const pw = rnd(120, 160); w.holes.push({ x, w: pw }); arc(x + pw / 2, 5, pw / 4, 110, G_ - 50); return pw; },
      (x) => { solid('crate', x, G_ - 48, 48, 48); row(x - 24, G_ - 84, 3, 48); return 48; },
      (x) => { solid('crate', x, G_ - 48, 48, 48); solid('crate', x + 48, G_ - 48, 48, 48); solid('crate', x + 48, G_ - 96, 48, 48); arc(x + 72, 3, 48, 40, G_ - 132); return 96; },
      (x) => { solid('rock', x, G_ - 32, 48, 32); arc(x + 24, 4, 44, 70, G_ - 62); return 48; },
      (x) => {
        w.platforms.push({ x, y: G_ - 112, w: 192, h: 24 }); row(x + 36, G_ - 146, 4, 40);
        if (Math.random() < 0.5) hazard('spikes', x + 48, G_ - 24, 96, 24, 6, 10);
        return 192;
      },
      (x) => { row(x, G_ - 34, 6, 48); return 260; },
      (x) => { hazard('cactus', x, G_ - 64, 40, 64, 8, 4); hazard('cactus', x + 280, G_ - 64, 40, 64, 8, 4); arc(x + 160, 5, 46, 115, G_ - 40); return 320; }
    ];
    let x = 900;
    while (x < LEVEL_LEN - 800) x += patterns[Math.floor(Math.random() * patterns.length)](x) + rnd(300, 460);

    // Solo contínuo, exceto nos buracos
    w.holes.sort((a, b) => a.x - b.x);
    let start = 0;
    for (const h of w.holes) { w.ground.push({ x: start, y: G, w: h.x - start, h: H - G }); start = h.x + h.w; }
    w.ground.push({ x: start, y: G, w: LEVEL_LEN - start, h: H - G });
    // Decoração (arbustos, mato, cogumelos e flores)
    for (let dx = 260; dx < LEVEL_LEN; dx += rnd(90, 220)) {
      if (w.holes.some((h) => dx > h.x - 40 && dx < h.x + h.w + 40)) continue;
      const r = Math.random();
      w.decor.push({ x: dx, k: r < 0.22 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : 3 });
    }
    return w;
  }
  // Recortes (em pixels) da folha decor.svg: [sx, sy, sw, sh]
  const DECOR = [[0, 0, 72, 48], [72, 20, 40, 28], [112, 16, 32, 32], [144, 8, 32, 40]];

  // ======================= PARTIDA =======================
  function resetGame() {
    world = buildWorld();
    player = { x: 120, y: GROUND_Y - HB.h, vx: 0, vy: 0, dir: 1, onGround: true, coyote: 0, buffer: 0, animT: 0, rot: 0, squash: 0 };
    camX = 0; timeLeft = GAME_TIME; coins = 0; maxX = player.x;
    particles = []; popups = []; flash = 0; shake = 0; dyingT = 0; reason = '';
    keys.jumpEdge = false; lastHud = '';
    updateHud();
  }
  function startGame() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resetGame();
    state = 'playing';
    $('startScreen').classList.add('hidden'); $('gameOver').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (IS_TOUCH) $('touch').classList.remove('hidden');   // botões de toque só em telas sensíveis ao toque
    sfx.start();
  }
  function die(why) {
    if (state !== 'playing') return;
    state = 'dying'; reason = why; dyingT = 1.0;
    player.vx = -player.dir * 140; player.vy = -620;
    shake = 0.45; flash = 0.55;
    burst(player.x + 16, player.y + 44, 30, ['#ff5a3c', '#ffd23f', '#ffffff'], 320);
    sfx.hit();
  }
  function showGameOver() {
    state = 'over';
    const msg = { time: 'O TEMPO ACABOU!', hazard: 'VOCÊ BATEU EM UM OBSTÁCULO!', pit: 'VOCÊ CAIU NO BURACO!' };
    $('reason').textContent = msg[reason] || '';
    $('finalScore').textContent = String(getScore());
    $('finalCoins').textContent = String(coins).padStart(2, '0');
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
    $('gameOver').classList.remove('hidden');
    $('retryBtn').focus();
  }
  const getScore = () => coins * 100 + Math.floor((maxX - 120) / 10);
  function updateHud() {
    const secs = Math.ceil(timeLeft), pct = Math.max(0, timeLeft / GAME_TIME * 100).toFixed(1);
    const sig = coins + '|' + secs + '|' + pct + '|' + getScore();
    if (sig === lastHud) return; lastHud = sig;
    $('coins').textContent = String(coins).padStart(2, '0');
    $('time').textContent = String(secs).padStart(2, '0');
    $('timeBar').style.width = pct + '%';
    $('score').textContent = String(getScore()).padStart(4, '0');
    $('timeBox').classList.toggle('danger', timeLeft <= 10);
  }

  // ======================= ENTRADA =======================
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
  window.addEventListener('keydown', (e) => {
    const k = keyMap[e.code];
    if (k) { e.preventDefault(); if (k === 'jump' && !keys.jump) keys.jumpEdge = true; keys[k] = true; }
    if (e.code === 'KeyM') muted = !muted;
    if (e.code === 'Enter' && (state === 'menu' || state === 'over')) { e.preventDefault(); startGame(); }
  });
  window.addEventListener('keyup', (e) => { const k = keyMap[e.code]; if (k) { keys[k] = false; } });
  window.addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });
  // Botões de toque
  function bindTouch(id, key) {
    const b = $(id);
    const on = (e) => { e.preventDefault(); if (key === 'jump' && !keys.jump) keys.jumpEdge = true; keys[key] = true; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); keys[key] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => b.addEventListener(n, off));
  }
  bindTouch('btnL', 'left'); bindTouch('btnR', 'right'); bindTouch('btnJ', 'jump');
  $('playBtn').addEventListener('click', startGame);
  $('retryBtn').addEventListener('click', startGame);

  // ======================= FÍSICA E COLISÃO =======================
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const near = (list, x) => list.filter((o) => o.x < x + 400 && o.x + o.w > x - 400);

  function updatePlayer(dt) {
    const p = player;
    const input = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const target = input * MOVE_SPEED, acc = (p.onGround ? 3200 : 2000) * dt;
    p.vx += Math.max(-acc, Math.min(acc, target - p.vx));
    if (input) p.dir = input;

    // Pulo: tolerância de "coyote time" (pular logo após sair da borda) e buffer (apertar um pouco antes de pousar)
    p.coyote = p.onGround ? COYOTE : p.coyote - dt;
    if (keys.jumpEdge) p.buffer = BUFFER; else p.buffer -= dt;
    keys.jumpEdge = false;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = JUMP_V; p.onGround = false; p.coyote = 0; p.buffer = 0; sfx.jump();
      puff(p.x + 16, p.y + HB.h, 6);
    }
    // Gravidade (mais forte ao soltar o botão durante a subida = pulo variável)
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt * (!keys.jump && p.vy < -200 ? 2.2 : 1));

    // Eixo X
    p.x = Math.max(0, Math.min(LEVEL_LEN - HB.w, p.x + p.vx * dt));
    const solids = near(world.ground, p.x).concat(near(world.solids, p.x));
    for (const s of solids) {
      if (overlap({ x: p.x, y: p.y, w: HB.w, h: HB.h }, s)) {
        if (p.vx > 0) p.x = s.x - HB.w; else if (p.vx < 0) p.x = s.x + s.w;
        p.vx = 0;
      }
    }
    // Eixo Y
    const prevBottom = p.y + HB.h, wasGround = p.onGround, fallV = p.vy;
    p.y += p.vy * dt; p.onGround = false;
    for (const s of solids) {
      if (overlap({ x: p.x, y: p.y, w: HB.w, h: HB.h }, s)) {
        if (p.vy > 0) { p.y = s.y - HB.h; p.vy = 0; p.onGround = true; }
        else if (p.vy < 0) { p.y = s.y + s.h; p.vy = 0; }
      }
    }
    for (const pl of near(world.platforms, p.x)) { // plataformas flutuantes: só colidem por cima
      if (p.vy >= 0 && prevBottom <= pl.y + 2 && p.y + HB.h >= pl.y && p.x + HB.w > pl.x && p.x < pl.x + pl.w) {
        p.y = pl.y - HB.h; p.vy = 0; p.onGround = true;
      }
    }
    if (p.onGround && !wasGround && fallV > 300) { p.squash = 0.18; puff(p.x + 16, p.y + HB.h, 8); }
    p.squash = Math.max(0, p.squash - dt);
    if (p.onGround && Math.abs(p.vx) > 100) { p.dustT = (p.dustT || 0) - dt; if (p.dustT <= 0) { p.dustT = 0.12; puff(p.x + 16 - p.dir * 10, p.y + HB.h, 1); } }
    p.animT += dt * Math.abs(p.vx) / MOVE_SPEED;
    maxX = Math.max(maxX, p.x);

    // Perigos
    const body = { x: p.x + 4, y: p.y + 4, w: HB.w - 8, h: HB.h - 8 };
    for (const hz of near(world.hazards, p.x)) if (overlap(body, hz.hit)) { die('hazard'); return; }
    if (p.y > GROUND_Y + 50) { die('pit'); return; }    // caiu em um buraco
    // Moedas
    for (const c of world.coins) {
      if (c.taken || Math.abs(c.x - p.x) > 200) continue;
      if (overlap(body, { x: c.x - 18, y: c.y - 18, w: 36, h: 36 })) {
        c.taken = true; coins++; sfx.coin();
        burst(c.x, c.y, 14, ['#ffd23f', '#fff6b0', '#ffffff'], 220);
        popups.push({ x: c.x, y: c.y - 20, txt: '+1', life: 0 });
      }
    }
  }

  // ======================= PARTÍCULAS =======================
  function burst(x, y, n, cols, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 40 + Math.random() * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0, max: 0.4 + Math.random() * 0.5, size: Math.random() < 0.5 ? 4 : 8, col: cols[(Math.random() * cols.length) | 0], g: 900 });
    }
  }
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) particles.push({ x: x + rnd(-8, 8), y: y - 2, vx: rnd(-60, 60), vy: rnd(-70, -10), life: 0, max: 0.3 + Math.random() * 0.2, size: 4, col: '#e8d5a8', g: 60 });
  }

  // ======================= ATUALIZAÇÃO =======================
  function update(dt) {
    t += dt;
    if (state === 'playing') {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; updateHud(); die('time'); }
      else { updatePlayer(dt); updateHud(); }
    } else if (state === 'dying') {            // animação de derrota: o personagem é arremessado e cai
      const p = player;
      p.vy += GRAVITY * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += -p.dir * 7 * dt;
      dyingT -= dt;
      if (dyingT <= 0) showGameOver();
    }
    if (state === 'menu') { camX += 140 * dt; if (camX > LEVEL_LEN - 2000) camX = 0; }
    else if (state === 'playing') {            // câmera acompanha o jogador suavemente
      const target = Math.max(0, Math.min(LEVEL_LEN - W, player.x - 300));
      camX += (target - camX) * Math.min(1, dt * 8);
    }
    for (const q of particles) { q.life += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    particles = particles.filter((q) => q.life < q.max);
    for (const pp of popups) { pp.life += dt; pp.y -= 50 * dt; }
    popups = popups.filter((pp) => pp.life < 0.7);
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt);
    for (const f of pollen) { f.x -= f.v * dt; f.y += Math.sin(t * 2 + f.s) * 10 * dt; if (f.x < -10) { f.x = W + 10; f.y = Math.random() * 400; } }
  }

  // ======================= DESENHO =======================
  const gradSun = ctx.createRadialGradient ? ctx.createRadialGradient(700, 240, 10, 700, 240, 260) : null;
  if (gradSun) { gradSun.addColorStop(0, 'rgba(255,240,170,.55)'); gradSun.addColorStop(1, 'rgba(255,240,170,0)'); }
  const gradVig = ctx.createRadialGradient ? ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620) : null;
  if (gradVig) { gradVig.addColorStop(0, 'rgba(10,5,30,0)'); gradVig.addColorStop(1, 'rgba(10,5,30,.45)'); }
  const gradPit = ctx.createLinearGradient ? ctx.createLinearGradient(0, GROUND_Y, 0, H) : null;
  if (gradPit) { gradPit.addColorStop(0, '#120c22'); gradPit.addColorStop(0.7, '#3a1233'); gradPit.addColorStop(1, '#d4501f'); }

  // Camada parallax: cada camada rola com um fator de velocidade diferente em relação à câmera
  function layer(im, off, y) {
    const o = -(((off % TILE) + TILE) % TILE);
    for (let x = Math.floor(o); x < W; x += TILE) di(im, x, Math.round(y));
  }

  function drawPlayer() {
    const p = player;
    ctx.save();
    if (state === 'dying' || state === 'over') {
      ctx.translate(Math.round(p.x + HB.w / 2), Math.round(p.y + HB.h / 2));
      ctx.rotate(p.rot);
      di(img['player-defeated'], -SPR.w / 2, -SPR.h / 2);
    } else {
      let f = 0;                                                   // quadros: 0 parado, 1 e 2 corrida, 3 pulo, 4 queda
      if (!p.onGround) f = p.vy < 0 ? 3 : 4;
      else if (Math.abs(p.vx) > 30) f = [1, 0, 2, 0][Math.floor(p.animT * 9) % 4];
      const sq = p.squash > 0 ? 1 - p.squash : 1;                  // esmagamento ao pousar
      ctx.translate(Math.round(p.x + HB.w / 2), Math.round(p.y + HB.h));
      ctx.scale(p.dir, 1);                                          // espelha quando olha para a esquerda
      if (sq < 1) ctx.scale(1 + (1 - sq), sq);
      di(img.player, f * SPR.w, 0, SPR.w, SPR.h, -32, -92, SPR.w, SPR.h);   // pés alinhados ao fundo da caixa de colisão
    }
    ctx.restore();
  }

  function drawWorld() {
    const cx = Math.floor(camX), G = GROUND_Y;
    // buracos: abismo escuro com brilho de lava no fundo
    for (const h of world.holes) if (h.x + h.w > cx && h.x < cx + W) { ctx.fillStyle = gradPit; ctx.fillRect(h.x, G, h.w, H - G); }
    // solo
    for (const s of world.ground) {
      if (s.x + s.w < cx || s.x > cx + W) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(s.x, G, s.w, H - G); ctx.clip();
      for (let tx = Math.floor(Math.max(s.x, cx) / 64) * 64; tx < Math.min(s.x + s.w, cx + W); tx += 64) di(img.ground, tx, G, 64, 100);
      ctx.restore();
    }
    for (const d of world.decor) if (d.x > cx - 80 && d.x < cx + W) { const r = DECOR[d.k]; di(img.decor, r[0], r[1], r[2], r[3], Math.round(d.x), G + 10 - r[3], r[2], r[3]); }
    for (const pl of world.platforms) if (pl.x + pl.w > cx && pl.x < cx + W) for (let i = 0; i < pl.w / 64; i++) di(img.platform, pl.x + i * 64, pl.y, 64, 24);
    for (const s of world.solids) {
      if (s.x + s.w < cx || s.x > cx + W) continue;
      if (s.type === 'crate') di(img.crate, s.x - 4, s.y - 4, 56, 56); else di(img.obstacles, 60, 0, 56, 40, s.x - 4, s.y - 4, 56, 40);
    }
    for (const h of world.hazards) {
      if (h.x + h.w < cx || h.x > cx + W) continue;
      if (h.type === 'cactus') di(img.cactus, h.x - 4, h.y - 4, 48, 72);
      else for (let i = 0; i < h.w / 48; i++) di(img.obstacles, 0, 8, 56, 32, h.x + i * 48 - 4, h.y - 4, 56, 32);
    }
    for (const c of world.coins) {                     // moedas: giram (largura oscila), flutuam e brilham
      if (c.taken || c.x < cx - 40 || c.x > cx + W + 40) continue;
      const bob = Math.sin(t * 3 + c.ph) * 4, wd = Math.max(8, Math.abs(Math.cos(t * 4 + c.ph)) * 48);
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(t * 5 + c.ph); ctx.fillStyle = '#ffe36a';
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, 30, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      di(img.coin, Math.round(c.x - wd / 2), Math.round(c.y + bob - 24), Math.round(wd), 48);
      if (Math.sin(t * 2.2 + c.ph * 3) > 0.92) { ctx.fillStyle = '#fff'; const sx = Math.round(c.x + 12), sy = Math.round(c.y + bob - 16); ctx.fillRect(sx - 2, sy - 8, 4, 16); ctx.fillRect(sx - 8, sy - 2, 16, 4); }
    }
    if (player) drawPlayer();
    for (const q of particles) { ctx.globalAlpha = Math.max(0, 1 - q.life / q.max); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 26px "Courier New", monospace'; ctx.textAlign = 'center';
    for (const pp of popups) { ctx.fillStyle = '#1f1a2e'; ctx.fillText(pp.txt, pp.x + 2, pp.y + 2); ctx.fillStyle = '#ffd23f'; ctx.fillText(pp.txt, pp.x, pp.y); }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    di(img.background, 0, 0, W, H);                                  // céu
    if (gradSun) { ctx.fillStyle = gradSun; ctx.fillRect(0, 0, W, H); }   // brilho do sol
    layer(img.clouds, camX * 0.08 + t * 16, 20);                    // nuvens: muito lentas (+ deriva)
    layer(img['mountains-far'], camX * 0.18, GROUND_Y - 240);       // montanhas distantes
    layer(img['mountains-near'], camX * 0.32, GROUND_Y - 180);      // montanhas próximas
    layer(img.trees, camX * 0.58, GROUND_Y - 278);                  // árvores: rápidas
    ctx.save();
    const sx = shake > 0 ? Math.round(rnd(-6, 6)) : 0, sy = shake > 0 ? Math.round(rnd(-4, 4)) : 0;
    ctx.translate(-Math.floor(camX) + sx, sy);                      // solo e objetos: velocidade total
    drawWorld();
    ctx.restore();
    // iluminação: luz do sol, vinheta e poeira/pólen flutuando
    const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,240,200,.16)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,210,.55)'; for (const f of pollen) ctx.fillRect(Math.round(f.x), Math.round(f.y), 4, 4);
    if (gradVig) { ctx.fillStyle = gradVig; ctx.fillRect(0, 0, W, H); }
    if (state === 'playing' && timeLeft <= 10 && timeLeft > 0) { ctx.fillStyle = 'rgba(224,70,60,' + (0.08 + 0.08 * Math.sin(t * 8)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash * 1.4).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ======================= LAÇO PRINCIPAL =======================
  function step(dt) { update(dt); if (world) draw(); }
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
    step(dt);
    requestAnimationFrame(frame);
  }
  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    $('stage').style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', resize); resize();

  loadImages().then(() => {
    world = buildWorld(); state = 'menu';       // o cenário rola ao fundo da tela inicial
    requestAnimationFrame(frame);
  });

  // Ganchos usados nos testes automatizados (não afetam o jogo)
  window.PixelAdventure = { step, getState: () => ({ state, timeLeft, coins, reason, score: getScore(), player, world, camX }) };
})();
