// CP Burger Breaker - Entidades: solo física + dibujo. Ninguna clase de
// aquí sabe qué es "un nivel" o "game over"; eso lo orquesta game.js.

window.CPGame = window.CPGame || {};

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Física reutilizable (AABB / círculo-rectángulo)
  // -------------------------------------------------------------------
  const Physics = {
    circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
      const closestX = Math.max(rx, Math.min(cx, rx + rw));
      const closestY = Math.max(ry, Math.min(cy, ry + rh));
      const dx = cx - closestX;
      const dy = cy - closestY;
      return (dx * dx + dy * dy) < (r * r);
    },
    // Devuelve 'x' o 'y' según qué eje del rectángulo fue golpeado (para
    // decidir si se invierte vx o vy al rebotar).
    collisionAxis(cx, cy, rx, ry, rw, rh) {
      const overlapLeft = cx - rx;
      const overlapRight = (rx + rw) - cx;
      const overlapTop = cy - ry;
      const overlapBottom = (ry + rh) - cy;
      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);
      return minX < minY ? 'x' : 'y';
    }
  };

  // -------------------------------------------------------------------
  class Paddle {
    constructor(worldWidth, worldHeight) {
      this.width = 84;
      this.baseWidth = 84;
      this.height = 16;
      this.x = worldWidth / 2;
      this.y = worldHeight - 46;
      this.color = '#FFF8E9';
      this.wideUntil = 0;
    }

    update(dt, targetNormalized, worldWidth, now) {
      if (this.wideUntil && now > this.wideUntil) {
        this.wideUntil = 0;
        this.width = this.baseWidth;
      }
      const targetX = targetNormalized * worldWidth;
      const lerpSpeed = 18; // suavizado, no teletransporte
      this.x += (targetX - this.x) * Math.min(1, lerpSpeed * dt);
      const half = this.width / 2;
      this.x = Math.max(half, Math.min(worldWidth - half, this.x));
    }

    applyWide(durationMs, now) {
      this.width = this.baseWidth * 1.5;
      this.wideUntil = now + durationMs;
    }

    left() { return this.x - this.width / 2; }
    top() { return this.y - this.height / 2; }

    draw(ctx) {
      const r = 8;
      const x = this.left();
      const y = this.top();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(x, y, this.width, this.height, r);
      ctx.fill();
      ctx.strokeStyle = '#EE282F';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------
  class Ball {
    constructor(x, y, speed) {
      this.x = x;
      this.y = y;
      this.radius = 8;
      this.speed = speed;
      this.baseSpeed = speed;
      this.vx = speed * 0.45;
      this.vy = -speed;
      this.color = '#EE282F';
      this.piercing = false;
      this.slowUntil = 0;
      this.launched = false;
      this.trail = [];
    }

    launch() {
      if (this.launched) return;
      this.launched = true;
    }

    update(dt, now) {
      if (!this.launched) return;
      if (this.slowUntil && now > this.slowUntil) {
        this.slowUntil = 0;
        this._rescaleToSpeed(this.baseSpeed);
      }
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    _rescaleToSpeed(newSpeed) {
      const currentSpeed = Math.hypot(this.vx, this.vy) || 1;
      const scale = newSpeed / currentSpeed;
      this.vx *= scale;
      this.vy *= scale;
      this.speed = newSpeed;
    }

    applySlow(durationMs, now) {
      this.slowUntil = now + durationMs;
      this._rescaleToSpeed(this.baseSpeed * 0.55);
    }

    applyFire(durationMs, now) {
      this.piercing = true;
      this.fireUntil = now + durationMs;
    }

    tickFire(now) {
      if (this.piercing && this.fireUntil && now > this.fireUntil) {
        this.piercing = false;
      }
    }

    bounceOffPaddle(paddle) {
      const hitPos = (this.x - paddle.x) / (paddle.width / 2); // -1..1
      const angle = hitPos * (Math.PI / 3); // hasta 60°
      const speed = Math.hypot(this.vx, this.vy);
      this.vx = speed * Math.sin(angle);
      this.vy = -Math.abs(speed * Math.cos(angle));
      this.y = paddle.top() - this.radius - 0.5;
    }

    draw(ctx) {
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const alpha = (i / this.trail.length) * 0.25;
        ctx.fillStyle = `rgba(238, 40, 47, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = this.piercing ? '#E8792E' : this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      if (this.piercing) {
        ctx.strokeStyle = 'rgba(232, 121, 46, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // -------------------------------------------------------------------
  class Brick {
    constructor(x, y, w, h, typeKey, typeDef) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.typeKey = typeKey;
      this.hp = typeDef.hp;
      this.maxHp = typeDef.hp;
      this.color = typeDef.color;
      this.points = typeDef.points;
      this.alive = true;
    }

    hit() {
      this.hp -= 1;
      if (this.hp <= 0) this.alive = false;
      return !this.alive;
    }

    draw(ctx) {
      const damaged = this.hp < this.maxHp;
      ctx.fillStyle = damaged ? this._shade(this.color, -0.25) : this.color;
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(this.x, this.y, this.w, this.h, 3);
      ctx.fill();
      ctx.stroke();
    }

    _shade(hex, amt) {
      const c = hex.replace('#', '');
      const num = parseInt(c, 16);
      let r = (num >> 16) + Math.round(255 * amt);
      let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
      let b = (num & 0xff) + Math.round(255 * amt);
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  // -------------------------------------------------------------------
  class PowerUp {
    constructor(x, y, key, typeDef) {
      this.x = x;
      this.y = y;
      this.key = key;
      this.color = typeDef.color;
      this.label = typeDef.label;
      this.duration = typeDef.duration;
      this.radius = 12;
      this.vy = 90;
      this.alive = true;
    }

    update(dt) {
      this.y += this.vy * dt;
    }

    draw(ctx) {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(this.x - 16, this.y - 12, 32, 24, 12);
      ctx.fill();
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.color = color;
      this.life = 0.4 + Math.random() * 0.3;
      this.maxLife = this.life;
      this.size = 2 + Math.random() * 2.5;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 220 * dt; // gravedad ligera
      this.life -= dt;
    }

    get alive() { return this.life > 0; }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  // -------------------------------------------------------------------
  class Projectile {
    constructor(x, y, vx, vy) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.radius = 7;
      this.alive = true;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(ctx) {
      ctx.fillStyle = '#A5171C';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFF8E9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------
  class Boss {
    constructor(worldWidth, def) {
      this.def = def;
      this.name = def.name;
      this.width = def.width;
      this.height = def.height;
      this.x = worldWidth / 2;
      this.y = 70;
      this.hp = def.hp;
      this.maxHp = def.hp;
      this.color = def.color;
      this.direction = 1;
      this.moveSpeed = def.moveSpeed;
      this.fireInterval = def.fireInterval;
      this.fireTimer = def.fireInterval * 0.5;
      this.phase = 1;
      this.alive = true;
      this.hitFlashUntil = 0;
    }

    update(dt, worldWidth, now) {
      if (this.phase === 1 && this.hp / this.maxHp <= this.def.phase2At) {
        this.phase = 2;
        this.fireInterval = this.def.phase2FireInterval;
        this.moveSpeed = this.def.moveSpeed * this.def.phase2MoveSpeedMult;
      }

      const half = this.width / 2;
      this.x += this.direction * this.moveSpeed * dt;
      if (this.x - half < 0) { this.x = half; this.direction = 1; }
      if (this.x + half > worldWidth) { this.x = worldWidth - half; this.direction = -1; }

      this.fireTimer -= dt * 1000;
      let shouldFire = false;
      if (this.fireTimer <= 0) {
        shouldFire = true;
        this.fireTimer = this.fireInterval;
      }
      return shouldFire;
    }

    hit(damage, now) {
      this.hp -= damage;
      this.hitFlashUntil = now + 90;
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
      }
    }

    left() { return this.x - this.width / 2; }
    top() { return this.y - this.height / 2; }

    draw(ctx, now) {
      const flashing = now < this.hitFlashUntil;
      ctx.fillStyle = flashing ? '#FFFFFF' : this.color;
      ctx.beginPath();
      ctx.roundRect(this.left(), this.top(), this.width, this.height, 10);
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cara simple (ojos) para que se lea como personaje, no como bloque.
      ctx.fillStyle = '#FFF8E9';
      const eyeY = this.y - 4;
      ctx.beginPath();
      ctx.arc(this.x - 24, eyeY, 6, 0, Math.PI * 2);
      ctx.arc(this.x + 24, eyeY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(this.x - 24, eyeY, 2.5, 0, Math.PI * 2);
      ctx.arc(this.x + 24, eyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  window.CPGame.Physics = Physics;
  window.CPGame.Entities = { Paddle, Ball, Brick, PowerUp, Particle, Projectile, Boss };
})();
