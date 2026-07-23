// Term Blaster — an arcade space-shooter built from your notes.
// Read the clue, fly your ship, and SHOOT the correct answer before it lands.
// A real action game: reflex + recall, lives, combos and rising speed.
import { el, clear, shuffle, sample, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';

export const meta = {
  id: 'blaster',
  name: 'Term Blaster',
  icon: '🚀',
  tagline: 'Shoot the right answer out of the sky.',
  accent: 'blue',
  min: 4,
};

export function mount(root, cards, ctx) {
  const usable = cards.filter((c) => c.term && c.definition);
  const TOTAL_ROUNDS = Math.min(10, usable.length);
  const W = 640;
  const H = 440;

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let canvas, g;
  let raf = 0;
  let running = false;

  // game state
  let order, roundIdx, score, lives, combo, blocks, bullets, particles, ship;
  let baseSpeed, shake, lastFire, resolved, message, messageColor, messageUntil;
  const keys = { left: false, right: false };

  function newRound() {
    const card = order[roundIdx];
    const distractors = sample(usable, 3, card).map((c) => c.term);
    const opts = shuffle([card.term, ...distractors]);
    const lanes = shuffle(opts.map((_, i) => i));
    blocks = opts.map((text, i) => ({
      text,
      correct: text === card.term,
      x: 60 + (lanes[i] * (W - 120)) / Math.max(1, opts.length - 1),
      y: -40 - i * 70,
      vy: baseSpeed + Math.random() * 0.3,
      w: 0,
      alive: true,
      hitFx: 0,
    }));
    bullets = [];
    resolved = false;
    setClue(card.definition);
  }

  function setClue(text) {
    const box = root.querySelector('.bl-clue-text');
    if (box) box.textContent = text;
  }

  function flash(msg, color) {
    message = msg;
    messageColor = color;
    messageUntil = performance.now() + 900;
  }

  function advance(failed) {
    if (resolved) return;
    resolved = true;
    if (failed) {
      lives--;
      shake = 14;
      flash('MISS', '#ff5252');
    }
    combo = failed ? 0 : combo;
    setTimeout(() => {
      roundIdx++;
      if (lives <= 0 || roundIdx >= TOTAL_ROUNDS) finish();
      else newRound();
    }, failed ? 650 : 400);
  }

  function hitBlock(block) {
    if (resolved) return;
    if (block.correct) {
      combo++;
      const gained = 100 + (combo - 1) * 20;
      score += gained;
      block.hitFx = 1;
      sound.play('correct');
      burst(block.x, block.y, '#2ec4b6', 26);
      flash(`+${gained}${combo > 1 ? `  x${combo}` : ''}`, '#2ec4b6');
      block.alive = false;
      advance(false);
    } else {
      // Wrong answer: lose a life but keep the round going — the correct
      // block is still falling and you can still shoot it.
      lives--;
      combo = 0;
      shake = 12;
      block.alive = false;
      sound.play('wrong');
      burst(block.x, block.y, '#ff5252', 18);
      flash('WRONG', '#ff5252');
      if (lives <= 0) finish();
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  }

  function fire() {
    const now = performance.now();
    if (now - lastFire < 180 || resolved) return;
    lastFire = now;
    sound.play('shoot');
    bullets.push({ x: ship.x, y: H - 46 });
  }

  function measure() {
    for (const b of blocks) {
      const tw = Math.min(W * 0.44, g.measureText(b.text).width + 26);
      b.w = Math.max(64, tw);
    }
  }

  function update() {
    // ship
    const speed = 6;
    if (keys.left) ship.x -= speed;
    if (keys.right) ship.x += speed;
    ship.x = Math.max(28, Math.min(W - 28, ship.x));

    // bullets
    for (const bu of bullets) bu.y -= 9;
    bullets = bullets.filter((bu) => bu.y > -10);

    // blocks
    for (const b of blocks) {
      if (!b.alive) continue;
      b.y += b.vy;
      // bullet collision
      for (const bu of bullets) {
        if (
          bu.x > b.x - b.w / 2 &&
          bu.x < b.x + b.w / 2 &&
          bu.y > b.y - 20 &&
          bu.y < b.y + 20
        ) {
          bu.y = -999;
          hitBlock(b);
          break;
        }
      }
      // reached bottom
      if (b.alive && b.y > H - 40) {
        if (b.correct) {
          b.alive = false;
          advance(true);
        } else {
          b.alive = false; // wrong ones falling off: no penalty
        }
      }
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.03;
    }
    particles = particles.filter((p) => p.life > 0);
    if (shake > 0) shake *= 0.85;
  }

  function draw() {
    g.save();
    const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
    g.translate(sx, sy);

    // background
    g.fillStyle = '#141024';
    g.fillRect(-20, -20, W + 40, H + 40);
    // stars
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      const yy = (i * 53 + (performance.now() / 30) % H) % H;
      g.fillRect((i * 79) % W, yy, 2, 2);
    }
    // ground line
    g.strokeStyle = '#ff5252';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, H - 30);
    g.lineTo(W, H - 30);
    g.stroke();

    // blocks
    g.font = '700 16px "DejaVu Sans", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    measure();
    for (const b of blocks) {
      if (!b.alive) continue;
      roundRect(b.x - b.w / 2, b.y - 20, b.w, 40, 10);
      g.fillStyle = '#ffc93c';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#141024';
      g.stroke();
      g.fillStyle = '#141024';
      let text = b.text;
      while (g.measureText(text).width > b.w - 16 && text.length > 4) {
        text = text.slice(0, -2);
      }
      if (text !== b.text) text = text.slice(0, -1) + '…';
      g.fillText(text, b.x, b.y + 1);
    }

    // bullets
    g.fillStyle = '#2ec4b6';
    for (const bu of bullets) g.fillRect(bu.x - 2, bu.y - 12, 4, 14);

    // ship
    g.save();
    g.translate(ship.x, H - 40);
    g.fillStyle = '#4361ee';
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(16, 14);
    g.lineTo(0, 6);
    g.lineTo(-16, 14);
    g.closePath();
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#141024';
    g.stroke();
    g.restore();

    // particles
    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 5, 5);
    }
    g.globalAlpha = 1;

    // flash message
    if (message && performance.now() < messageUntil) {
      g.font = '800 34px "DejaVu Sans", system-ui, sans-serif';
      g.fillStyle = messageColor;
      g.fillText(message, W / 2, H / 2);
    }
    g.restore();
  }

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  function updateHud() {
    const hearts = root.querySelector('.bl-lives');
    const sc = root.querySelector('.bl-score');
    const rd = root.querySelector('.bl-round');
    if (hearts) hearts.textContent = '❤'.repeat(Math.max(0, lives)) + '·'.repeat(Math.max(0, 3 - lives));
    if (sc) sc.textContent = 'SCORE ' + score;
    if (rd) rd.textContent = `WAVE ${Math.min(roundIdx + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`;
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    stopLoop();
    clear(root);
    const total = TOTAL_ROUNDS * 100;
    if (lives > 0) {
      sound.play('win');
      confetti();
    }
    root.appendChild(
      resultPanel({
        score,
        total,
        message: lives > 0 ? 'Wave cleared, pilot!' : 'Ship down!',
        onReplay: startGame,
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(score, total);
  }

  function startGame() {
    finished = false;
    order = shuffle(usable).slice(0, TOTAL_ROUNDS);
    roundIdx = 0;
    score = 0;
    lives = 3;
    combo = 0;
    particles = [];
    baseSpeed = 0.85;
    shake = 0;
    lastFire = 0;
    message = '';
    ship = { x: W / 2 };
    buildDom();
    newRound();
    startLoop();
  }

  function startLoop() {
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function buildDom() {
    clear(root);
    canvas = el('canvas.bl-canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.aspectRatio = `${W}/${H}`;
    g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    const left = el('button.bl-pad', { text: '◀', 'aria-label': 'left' });
    const fireBtn = el('button.bl-pad.bl-fire', { text: 'FIRE', 'aria-label': 'fire' });
    const right = el('button.bl-pad', { text: '▶', 'aria-label': 'right' });
    const hold = (btn, on) => {
      const set = (v) => (e) => {
        e.preventDefault();
        keys[on] = v;
      };
      btn.addEventListener('pointerdown', set(true));
      btn.addEventListener('pointerup', set(false));
      btn.addEventListener('pointerleave', set(false));
      btn.addEventListener('pointercancel', set(false));
    };
    hold(left, 'left');
    hold(right, 'right');
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fire();
    });

    // drag / tap on canvas
    canvas.addEventListener('pointerdown', (e) => {
      moveToPointer(e);
      fire();
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pressure > 0 || e.buttons) moveToPointer(e);
    });

    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.bl-topbar', {}, [
          el('span.bl-lives'),
          el('span.bl-round'),
          el('span.bl-score'),
        ]),
        el('div.bl-clue', {}, [
          el('span.bl-clue-label', { text: 'CLUE' }),
          el('span.bl-clue-text'),
        ]),
        canvas,
        el('div.bl-controls', {}, [left, fireBtn, right]),
        el('p.bl-hint', { text: 'Move: ← →  or  A D  ·  Shoot: Space  ·  or drag & tap' }),
      ])
    );
  }

  function moveToPointer(e) {
    const rect = canvas.getBoundingClientRect();
    ship.x = ((e.clientX - rect.left) / rect.width) * W;
  }

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ') fire();
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  startGame();

  // cleanup returned to the app so we stop the loop + listeners on navigation.
  return function cleanup() {
    stopLoop();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
