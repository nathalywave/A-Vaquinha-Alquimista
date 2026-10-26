// ===== A VAQUINHA ALQUIMISTA =====
const W = 960, H = 480;
const C = document.getElementById('game'), X = C.getContext('2d');
X.imageSmoothingEnabled = false;

// ---------- IMAGENS (pasta "imagens") ----------
const FILES = [
  'vaquinha-hunana-esquerda.png','vaquinha-hunana-direita.png',
  'vaca-lado-esquerdo.png','vaca-lado-direito.png',
  'vaca-de-frente-parada.png','vaca-de-frente-assustada.png','vaca-de-costas-parada.png',
  'vaca-de-costas-com-arma-lado-esquerdo.png','vaca-de-costas-com-arma-lado-direito.png',
  'fundo-floresta.jpg','fundo-celeiro.jpg',
  'cristal-magico.png','mapa-fazendinha-do-amor.jpg','mapa-floresta-dos-sussurros.jpg',
  'praga-direita.png','praga-esquerda.png','seitista-direita.png','seitista-esquerda.png',
  'seu-joaquim-direita.png','seu-joaquim-esquerda.png',
  'vaca-andando-para-frente-pe-direito-frente.png','vaca-andando-para-frente-pe-esquerdo-frente.png',
  'vaca-apontando-arma-para-direita.png','vaca-apontando-arma-para-esquerda.png',
  'vaca-caminhando-direita.png','vaca-caminhando-esquerda.png'
];
const IMG = {};
FILES.forEach(f => { const i = new Image(); i.onload = () => i.ok = true; i.src = 'imagens/' + f; IMG[f] = i; });

function bg(f, dark) {
  const i = IMG[f];
  if (i && i.ok) X.drawImage(i, 0, 0, W, H); else { X.fillStyle = '#2d6a2d'; X.fillRect(0, 0, W, H); }
  if (dark) { X.fillStyle = 'rgba(0,0,0,' + dark + ')'; X.fillRect(0, 0, W, H); }
}
// desenha sprite com os "pés" em (x,y); se faltar imagem, desenha um retângulo colorido
function spr(f, x, y, h, col) {
  const i = IMG[f];
  if (i && i.ok) { const w = h * i.width / i.height; X.drawImage(i, x - w / 2, y - h, w, h); }
  else { X.fillStyle = col || '#fff'; X.fillRect(x - h / 4, y - h, h / 2, h); }
}

// ---------- TECLADO ----------
const K = {}, J = {}; // K = segurando, J = apertou neste frame
addEventListener('keydown', e => {
  if (!K[e.code]) J[e.code] = true;
  K[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => K[e.code] = false);
const OK = () => J.Enter || J.Space;

// ---------- ESTADO ----------
// LIMITES DE ANDAR da vaquinha (posição dos pés). Ajuste aqui se mudar os fundos!
const BND = {
  farm:   { x1: 30, x2: 575, y1: 330, y2: 465 }, // trator e celeiro bloqueiam a direita
  forest: { x1: 30, x2: 930, y1: 305, y2: 465 }
};
let S = 'menu', level = 'farm', D = null, LD = null, P, pragas, inim, tiros, kills, power, mix, crystal, joaquim, spawnT, flash, credY, debug = false;

function resetPlayer() {
  P = { x: 200, y: 400, hp: 5, ammo: 6, max: 6, dir: 'r', h: 'r', moving: false, walk: 0, rl: 0, cool: 0, aim: 0, inv: 0, human: false };
}

// ---------- DIÁLOGOS ----------
function openDialog(lines, cb) { D = { lines, i: 0, cb: cb || (() => S = 'play') }; S = 'dialog'; }
const TXT = {
  intro: [
    ['Narrador', 'Na Fazendinha do Amor, uma vaquinha ajuda a proteger a plantação do Seu Joaquim.'],
    ['Narrador', 'Mas a paz acabou: pragas estranhas começaram a invadir a propriedade!'],
    ['Vaquinha', 'Minha arma de leite está carregada. Ninguém estraga essa plantação!'],
    ['Dica', 'Mover: setas ou WASD  |  Atirar: ESPAÇO  |  Recarregar: R'],
    ['Dica', 'Derrote 10 pragas!']
  ],
  aposFazenda: [
    ['Vaquinha', 'Acabei com as pragas... Seu Joaquim? Cadê o Seu Joaquim?!'],
    ['Narrador', 'Um grupo misterioso levou o fazendeiro para a Floresta dos Sussurros!'],
    ['Vaquinha', 'Eu vou resgatar meu amigo!']
  ],
  floresta: [
    ['Narrador', 'Floresta dos Sussurros. Algo brilha entre as árvores...'],
    ['Dica', 'Pegue a pedra mágica azul e roxa e misture com seu leite (ALQUIMIA!).'],
    ['Dica', 'Derrote 8 sectários e encontre o Seu Joaquim.']
  ],
  achou: [
    ['Narrador', 'Os sectários fugiram! Seu Joaquim está logo adiante...'],
  ],
  fim1: [
    ['Seu Joaquim', 'Você me salvou! Obrigado, minha vaquinha!'],
    ['Seu Joaquim', 'Tenho um segredo: eu entendo de alquimia muito mais do que aparentava.'],
    ['Seu Joaquim', 'Transformar uma substância em outra é só o começo de algo maior...'],
    ['Seu Joaquim', 'Como agradecimento... TRANSMUTAÇÃO!']
  ],
  fim2: [
    ['Vaquinha', 'Eu... virei humana?!'],
    ['Narrador', 'A aventura termina com a descoberta de que até uma simples vaquinha pode mudar o próprio destino.']
  ]
};

// ---------- FASES ----------
function startLoading(to) { LD = { to, t: 0 }; S = 'loading'; }

function startFarm() {
  level = 'farm'; resetPlayer(); pragas = []; inim = []; tiros = []; kills = 0; spawnT = 0; power = false; crystal = null; joaquim = null;
  openDialog(TXT.intro);
}
function startForest() {
  level = 'forest'; const keep = P.hp; resetPlayer(); P.hp = Math.max(keep, 3); P.x = 120; P.y = 400;
  pragas = []; inim = []; tiros = []; kills = 0; spawnT = 0; power = false; joaquim = null;
  crystal = { x: 330, y: 395, taken: false };
  openDialog(TXT.floresta);
}

// ---------- LOOP PRINCIPAL ----------
function loop() {
  update(); draw();
  for (const k in J) delete J[k];
  requestAnimationFrame(loop);
}

function update() {
  if (S === 'menu') { if (OK()) startLoading('farm'); }
  else if (S === 'loading') { if (++LD.t > 140) LD.to === 'farm' ? startFarm() : startForest(); }
  else if (S === 'dialog') {
    if (OK()) { D.i++; if (D.i >= D.lines.length) { const cb = D.cb; D = null; cb(); } }
  }
  else if (S === 'play') playUpdate();
  else if (S === 'alchemy') {
    if (J.Space) { mix++; if (mix >= 10) { power = true; crystal.taken = true; P.max = 8; P.ammo = 8; S = 'play'; } }
  }
  else if (S === 'transform') {
    flash++;
    if (flash === 60) P.human = true;
    if (flash > 120) openDialog(TXT.fim2, () => { S = 'credits'; credY = H; });
  }
  else if (S === 'credits') { credY -= 0.8; if (J.Enter && credY < -300) S = 'menu'; }
  else if (S === 'over') { if (J.Enter) startLoading(level); }
  if (J.KeyB) debug = !debug;
}

function playUpdate() {
  const b = BND[level];
  let dx = 0, dy = 0;
  if (K.ArrowLeft || K.KeyA) dx--;
  if (K.ArrowRight || K.KeyD) dx++;
  if (K.ArrowUp || K.KeyW) dy--;
  if (K.ArrowDown || K.KeyS) dy++;
  P.moving = !!(dx || dy);
  if (P.moving) {
    const m = Math.hypot(dx, dy);
    P.x += dx / m * 3.2; P.y += dy / m * 3.2; P.walk += 0.15;
    if (dx) { P.dir = dx < 0 ? 'l' : 'r'; P.h = P.dir; } else P.dir = dy < 0 ? 'u' : 'd';
  }
  // LIMITES: a vaquinha não sai da área andável
  P.x = Math.max(b.x1, Math.min(b.x2, P.x));
  P.y = Math.max(b.y1, Math.min(b.y2, P.y));

  // recarregar (o leite enche a arma)
  if (J.KeyR && P.rl <= 0 && P.ammo < P.max) P.rl = 60;
  if (P.rl > 0 && --P.rl === 0) P.ammo = P.max;
  // atirar
  if (P.cool > 0) P.cool--; if (P.aim > 0) P.aim--; if (P.inv > 0) P.inv--;
  if (K.Space && P.cool <= 0 && P.rl <= 0 && P.ammo > 0) {
    const v = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[P.dir];
    tiros.push({ x: P.x + v[0] * 30, y: P.y - 46 + v[1] * 12, vx: v[0] * 9, vy: v[1] * 9, dmg: power ? 2 : 1 });
    P.ammo--; P.cool = 14; P.aim = 14;
  }
  // tiros
  tiros.forEach(t => { t.x += t.vx; t.y += t.vy; });
  tiros = tiros.filter(t => t.x > 0 && t.x < W && t.y > 0 && t.y < H && !t.dead);

  // ---- inimigos ----
  spawnT--;
  if (level === 'farm') {
    if (spawnT <= 0 && kills + pragas.length < 10 && pragas.length < 4) {
      pragas.push(mkEnemy(b, 44, 1.6 + Math.random() * 0.6, 1)); spawnT = 70;
    }
    moveEnemies(pragas, b);
    kills = killsFrom(pragas, kills);
    if (kills >= 10) { S = 'wait'; openDialog(TXT.aposFazenda, () => startLoading('forest')); }
  } else {
    if (spawnT <= 0 && kills + inim.length < 8 && inim.length < 2) {
      inim.push(mkEnemy(b, 100, 1.1, 4)); spawnT = 110;
    }
    moveEnemies(inim, b);
    kills = killsFrom(inim, kills);
    // cristal + alquimia
    if (crystal && !crystal.taken && Math.hypot(P.x - crystal.x, P.y - crystal.y) < 45) { S = 'alchemy'; mix = 0; }
    if (kills >= 8 && !joaquim) { joaquim = { x: 860, y: 410 }; openDialog(TXT.achou); }
    if (joaquim && Math.hypot(P.x - joaquim.x, P.y - joaquim.y) < 80) { P.h = 'r'; openDialog(TXT.fim1, () => { S = 'transform'; flash = 0; }); }
  }
  if (P.hp <= 0) S = 'over';
}

function mkEnemy(b, h, spd, hp) {
  const left = Math.random() < 0.5;
  return { x: left ? b.x1 : b.x2, y: b.y1 + Math.random() * (b.y2 - b.y1), h, spd, hp, face: left ? 'r' : 'l' };
}
function moveEnemies(list, b) {
  list.forEach(e => {
    const dx = P.x - e.x, dy = P.y - e.y, m = Math.hypot(dx, dy) || 1;
    if (m > 28) { e.x += dx / m * e.spd; e.y += dy / m * e.spd; }
    if (Math.abs(dx) > 4) e.face = dx < 0 ? 'l' : 'r';
    e.x = Math.max(b.x1, Math.min(b.x2, e.x)); e.y = Math.max(b.y1, Math.min(b.y2, e.y));
    // tiro acerta?
    tiros.forEach(t => {
      if (!t.dead && Math.abs(t.x - e.x) < e.h * 0.35 + 6 && t.y > e.y - e.h && t.y < e.y + 6) { t.dead = true; e.hp -= t.dmg; e.hit = 6; }
    });
    // encosta na vaquinha?
    if (P.inv <= 0 && Math.abs(P.x - e.x) < 30 && Math.abs(P.y - e.y) < 18) { P.hp--; P.inv = 70; }
    if (e.hit) e.hit--;
  });
}
function killsFrom(list, k) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].hp <= 0) { list.splice(i, 1); k++; }
  return k;
}

// ---------- DESENHO ----------
function pSprite() {
  if (P.human) return P.h === 'l' ? 'vaquinha-hunana-esquerda.png' : 'vaquinha-hunana-direita.png';
  const s1 = P.h === 'l' ? 'esquerdo' : 'direito', s2 = P.h === 'l' ? 'esquerda' : 'direita', d = P.dir;
  if (P.aim > 0) {
    if (d === 'l' || d === 'r') return `vaca-apontando-arma-para-${s2}.png`;
    if (d === 'u') return `vaca-de-costas-com-arma-lado-${s1}.png`;
    return 'vaca-de-frente-parada.png';
  }
  if (P.moving) {
    if (d === 'l' || d === 'r') return `vaca-caminhando-${s2}.png`;
    if (d === 'd') return Math.floor(P.walk) % 2 ? 'vaca-andando-para-frente-pe-direito-frente.png' : 'vaca-andando-para-frente-pe-esquerdo-frente.png';
    return 'vaca-de-costas-parada.png';
  }
  if (d === 'd') return P.inv > 0 ? 'vaca-de-frente-assustada.png' : 'vaca-de-frente-parada.png';
  if (d === 'u') return `vaca-de-costas-com-arma-lado-${s1}.png`;
  return `vaca-lado-${s1}.png`;
}
function shadow(x, y, w) { X.fillStyle = 'rgba(0,0,0,.28)'; X.beginPath(); X.ellipse(x, y, w, w / 4, 0, 0, 7); X.fill(); }

function drawWorld() {
  bg(level === 'farm' ? 'fundo-celeiro.jpg' : 'fundo-floresta.jpg');
  if (debug) { const b = BND[level]; X.strokeStyle = 'red'; X.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1); }
  const q = []; // ordenado por profundidade (y)
  q.push({ y: P.y, f: () => {
    shadow(P.x, P.y, 28);
    if (P.inv > 0 && Math.floor(P.inv / 5) % 2) X.globalAlpha = 0.5;
    spr(pSprite(), P.x, P.y, 96, '#fff'); X.globalAlpha = 1;
  } });
  pragas.forEach(e => q.push({ y: e.y, f: () => { shadow(e.x, e.y, 18); spr(e.face === 'l' ? 'praga-direita.png' : 'praga-esquerda.png', e.x, e.y, e.h, '#888'); } }));
  inim.forEach(e => q.push({ y: e.y, f: () => { shadow(e.x, e.y, 28); if (e.hit) X.globalAlpha = 0.6; spr(e.face === 'l' ? 'seitista-direita.png' : 'seitista-esquerda.png', e.x, e.y, e.h, '#a22'); X.globalAlpha = 1; } }));
  if (crystal && !crystal.taken) q.push({ y: crystal.y, f: () => {
    const bob = Math.sin(Date.now() / 300) * 4;
    X.fillStyle = 'rgba(140,120,255,.35)'; X.beginPath(); X.arc(crystal.x, crystal.y - 24 + bob, 30, 0, 7); X.fill();
    spr('cristal-magico.png', crystal.x, crystal.y + bob, 50, '#86f');
  } });
  if (joaquim) q.push({ y: joaquim.y, f: () => { shadow(joaquim.x, joaquim.y, 28); spr('seu-joaquim-esquerda.png', joaquim.x, joaquim.y, 100, '#c93'); } });
  q.sort((a, b) => a.y - b.y).forEach(o => o.f());
  // tiros de leite (fica azul/roxo depois da alquimia)
  tiros.forEach(t => {
    X.beginPath(); X.arc(t.x, t.y, power ? 8 : 6, 0, 7);
    X.fillStyle = power ? (Math.floor(Date.now() / 80) % 2 ? '#5aa9ff' : '#b05cff') : '#fffdf5'; X.fill();
    X.strokeStyle = power ? '#fff' : '#cfd8dc'; X.lineWidth = 2; X.stroke();
  });
}

function box(x, y, w, h) { X.fillStyle = 'rgba(20,12,30,.85)'; X.fillRect(x, y, w, h); X.strokeStyle = '#e8c27a'; X.lineWidth = 3; X.strokeRect(x, y, w, h); }
function txt(s, x, y, size, col, al) { X.font = `bold ${size}px "Trebuchet MS", sans-serif`; X.fillStyle = col || '#fff'; X.textAlign = al || 'left'; X.fillText(s, x, y); }
function wrap(t, w) {
  const out = []; let l = '';
  for (const word of t.split(' ')) { if (X.measureText(l + word).width > w) { out.push(l); l = ''; } l += word + ' '; }
  out.push(l); return out;
}

function hud() {
  box(10, 10, 300, 62);
  txt('Vida: ' + '❤'.repeat(Math.max(P.hp, 0)), 22, 36, 18, '#ff8a8a');
  txt('Leite: ' + (P.rl > 0 ? 'recarregando...' : '●'.repeat(P.ammo) + '○'.repeat(P.max - P.ammo)), 22, 60, 18, power ? '#9ec9ff' : '#fff');
  box(W - 310, 10, 300, 40);
  if (level === 'farm') txt(`Pragas derrotadas: ${kills}/10`, W - 295, 37, 18);
  else txt(power ? `Sectários: ${kills}/8  (leite alquímico!)` : `Sectários: ${kills}/8 - pegue a pedra!`, W - 295, 37, 16, power ? '#c9a8ff' : '#fff');
  if (P.ammo === 0 && P.rl <= 0) txt('Aperte R para recarregar!', W / 2, 40, 22, '#ffe28a', 'center');
}

function draw() {
  X.clearRect(0, 0, W, H);
  if (S === 'menu') {
    bg('mapa-fazendinha-do-amor.jpg', 0.45);
    txt('A VAQUINHA ALQUIMISTA', W / 2, 190, 52, '#ffe28a', 'center');
    if (Math.floor(Date.now() / 500) % 2) txt('Pressione ENTER para começar', W / 2, 270, 24, '#fff', 'center');
    txt('Mover: setas/WASD  |  Atirar: ESPAÇO  |  Recarregar: R', W / 2, 440, 16, '#ddd', 'center');
  }
  else if (S === 'loading') {
    bg(LD.to === 'farm' ? 'mapa-fazendinha-do-amor.jpg' : 'mapa-floresta-dos-sussurros.jpg', 0.5);
    txt('Carregando ' + (LD.to === 'farm' ? 'Fazendinha do Amor' : 'Floresta dos Sussurros') + '...', W / 2, 380, 28, '#fff', 'center');
    X.fillStyle = '#222'; X.fillRect(280, 400, 400, 18);
    X.fillStyle = '#e8c27a'; X.fillRect(280, 400, 400 * Math.min(LD.t / 140, 1), 18);
  }
  else if (S === 'credits') {
    bg('mapa-floresta-dos-sussurros.jpg', 0.75);
    const L = [['A Vaquinha Alquimista', 40], ['', 0], ['Direção', 20], ['Nath Wave', 30], ['', 0], ['Artes', 20], ['Lucas Trew', 30], ['', 0], ['Roteiro', 20], ['Josieli Souza', 30], ['', 0], ['Codificação', 20], ['Allan Theodoro e Ana Cláudia', 30], ['', 0], ['Obrigado por jogar!', 34]];
    let y = credY; L.forEach(([s, sz]) => { txt(s, W / 2, y, sz || 20, sz === 20 ? '#e8c27a' : '#fff', 'center'); y += (sz || 20) + 22; });
    if (credY < -300) txt('ENTER para voltar ao menu', W / 2, 440, 20, '#ffe28a', 'center');
  }
  else if (S === 'alchemy') {
    drawWorld(); X.fillStyle = 'rgba(10,0,30,.8)'; X.fillRect(0, 0, W, H);
    txt('ALQUIMIA!', W / 2, 90, 40, '#c9a8ff', 'center');
    txt('Aperte ESPAÇO várias vezes para misturar o leite com a pedra mágica!', W / 2, 135, 20, '#fff', 'center');
    // frasco: o leite vai de branco para azul/roxo
    const p = mix / 10;
    X.strokeStyle = '#fff'; X.lineWidth = 4; X.strokeRect(410, 170, 140, 230);
    const g = X.createLinearGradient(410, 400, 550, 170);
    g.addColorStop(0, `rgb(${255 - p * 120},${255 - p * 150},255)`); g.addColorStop(1, `rgb(${255 - p * 80},${255 - p * 190},255)`);
    X.fillStyle = g; X.fillRect(414, 400 - 226 * (0.4 + 0.6 * p), 132, 226 * (0.4 + 0.6 * p));
    for (let i = 0; i < 6; i++) { X.fillStyle = 'rgba(255,255,255,.6)'; X.beginPath(); X.arc(430 + i * 22, 390 - ((Date.now() / 12 + i * 37) % 200), 4, 0, 7); X.fill(); }
    txt(`${mix}/10`, W / 2, 440, 24, '#fff', 'center');
  }
  else {
    drawWorld();
    if (S !== 'menu') hud();
    if (S === 'transform') {
      const a = flash < 60 ? flash / 60 : 1 - (flash - 60) / 60;
      X.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`; X.fillRect(0, 0, W, H);
      txt('TRANSMUTAÇÃO!', W / 2, 90, 44, '#9a5cff', 'center');
    }
    if (S === 'over') {
      X.fillStyle = 'rgba(0,0,0,.7)'; X.fillRect(0, 0, W, H);
      txt('A vaquinha se cansou...', W / 2, 220, 40, '#ff8a8a', 'center');
      txt('Pressione ENTER para tentar de novo', W / 2, 270, 22, '#fff', 'center');
    }
    if (S === 'dialog') {
      const [who, t] = D.lines[D.i];
      box(40, 340, W - 80, 120);
      txt(who, 60, 370, 20, '#e8c27a');
      X.font = '20px "Trebuchet MS", sans-serif';
      wrap(t, W - 130).forEach((l, i) => txt(l, 60, 402 + i * 26, 20, '#fff'));
      txt('ENTER ▶', W - 60, 448, 14, '#aaa', 'right');
    }
  }
}

loop();
 
