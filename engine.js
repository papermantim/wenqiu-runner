/**
 * 稳球前行 — side-view runner.
 * A / ← tilts the plank so the ball rolls left on screen.
 * D / → tilts it so the ball rolls right. Space / W / ↑ jumps.
 * The runner always faces right; the world scrolls. Not a steering vehicle.
 */

                                                      
                                                

                   
               
                 
                
               
                      
                     
                
                  
                 
  

                                                 

                 
                 
            
            
            
             
                  
  

                 
                 
            
            
             
             
               
              
               
                                           
  

                
                 
            
            
               
               
  

             
                
                
               
               
               
               
  

const BEST_KEY = "wenqiu-distance-best-v2";
const BOARD_LEN = 176;
const BOARD_THICK = 14;
const BALL_R = 14;
const BALL_LIMIT = BOARD_LEN / 2 - 10;
const GRAVITY = 1400;
const JUMP_V = -720;

const INK = "#20251f";
const PAPER = "#f6f3df";
const WASH = "#c3b4dc";
const WASH_DEEP = "#9c8bb7";
const SAGE = "#55bca5";
const CORAL = "#f39bbf";
const WOOD = "#efd45d";
const WOOD_DEEP = "#b69745";

const OBSTACLE_KINDS         = ["stump", "crate", "rock", "fence", "stump", "crate"];

function clamp(n        , a        , b        ) {
  return Math.max(a, Math.min(b, n));
}

function loadBest()         {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveBest(n        ) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

function tuneAt(meters        )       {
  const t = clamp(meters / 360, 0, 1);
  const s = t * t * (3 - 2 * t);
  return {
    speed: 210 + s * 120,
    ballG: 560 + s * 200,
    kick: 52 + s * 24,
    gait: 0.085 + s * 0.045,
    bias: 6 + s * 10,
    damp: 0.78 - s * 0.22,
  };
}

function hash(n        ) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

                             
                                     
                    
                         
                             
                         
                        
                          
                                                                         
                        
                        
                         
  

                
                    
                                   
   
 

// A planted foot travels backwards as the runner advances; the other lifts forward.
export function walkingLeg(phase       , side       ) {
  const t=((phase/(Math.PI*2)+(side===1?.5:0))%1+1)%1;
  const swing=t>=.5, u=swing?(t-.5)*2:t*2;
  const footX=swing?-18+18*(1-Math.cos(Math.PI*u)):18-36*u;
  const footY=swing?-8-13*Math.sin(Math.PI*u):-8;
  const hipX=side*3,hipY=-38,dx=footX-hipX,dy=footY-hipY;
  const length=23, distance=Math.hypot(dx,dy);
  const bend=Math.sqrt(Math.max(0,length*length-distance*distance/4));
  return {hipX,hipY,footX,footY,kneeX:(hipX+footX)/2+dy/distance*bend,
    kneeY:(hipY+footY)/2-dx/distance*bend,swing};
}

export class BalanceGame {
          canvas                   ;
          ctx                          ;
          onHud                    ;
          ac = new AbortController();
          raf = 0;
          last = 0;
          acc = 0;
          running = true;

          cssW = 1;
          cssH = 1;
          dpr = 1;
          viewW = 960;
          viewH = 540;
          groundY = 420;
          playerX = 200;

          keys = new Set        ();
          pointer = { left: false, right: false, jump: false };
          prevJump = false;

  phase        = "menu";
          reason              = "";
          bestAtStart = 0;
          freshBest = false;
          best = 0;
          meters = 0;
          bonus = 0;
          runScroll = 0;
          cam = 0;
          time = 0;
          walkPhase = 0;
          prevSin = 0;
          speed = 40;

          feetY = 420;
          vy = 0;
          grounded = true;
          coyote = 0;
          buffer = 0;
          angle = 0;
          visualAngle = 0;
          ballU = 0;
          ballV = 0;
          roll = 0;
          squash = 0;
          shake = 0;
          hitstop = 0;
          fallT = 0;
          fallX = 0;
          fallY = 0;
          fallVx = 0;
          fallVy = 0;
          spawnCursor = 0;
          crashLean = 0;
          combo = 0;
          paused = false;
          muted = false;
          prevPause = false;
          prevMute = false;
          wind = 0;
          windDir = 0;
          windTime = 0;
          windWarning = 0;
          windStrength = 0;
          passedFlag = false;

          obstacles             = Array.from({ length: 14 }, () => ({
    alive: false,
    x: 0,
    w: 40,
    h: 40,
    kind: "crate"        ,
    scored: false,
  }));

          particles             = Array.from({ length: 70 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 3,
    kind: "dust"         ,
  }));

          floaters            = Array.from({ length: 6 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    life: 0,
    text: "",
  }));

          audioCtx                      = null;
          noiseBuf                     = null;
          grain                       = null;
          heroArt = new Image();
          propsArt = new Image();
          groundArt = new Image();
          heroFrames             = [];
          propFrames             = [];
          forestArt                          = null;

  constructor(canvas                   , onHud                    ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    this.ctx = ctx;
    this.makeGrain();
    this.heroArt.onload = () => { this.heroFrames = this.atlasFrames(this.heroArt, 3, 2); };
    this.propsArt.onload = () => { this.propFrames = this.atlasFrames(this.propsArt, 4, 2); };
    this.heroArt.src = new URL('./hero-atlas.png', import.meta.url).href;
    this.propsArt.src = new URL('./props-atlas.png', import.meta.url).href;
    this.groundArt.src = new URL('./ground-tile.png', import.meta.url).href;
    this.forestArt = new Image();
    this.forestArt.src = new URL('./doodle-forest.png', import.meta.url).href;
    this.onHud = onHud;
    this.best = loadBest();
    this.resize();
    this.feetY = this.groundY;
    this.bind();
    this.emit();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.exposeProbe();
  }

  dispose() {
    this.running = false;
    this.ac.abort();
    cancelAnimationFrame(this.raf);
    if (this.audioCtx) void this.audioCtx.close();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  setPointer(which                           , down         ) {
    this.pointer[which] = down;
  }

  togglePause() {
    if (this.phase !== "play" && this.phase !== "fall") return;
    this.paused = !this.paused;
    if (this.paused) this.releaseAll();
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.emit();
  }

  setKeys(codes          ) {
    this.keys = new Set(codes);
  }

  start() {
    this.unlockAudio();
    this.startRun();
  }

          exposeProbe() {
    const dev = false || new URLSearchParams(location.search).has("qa");
    if (!dev) return;
    window.__controlsTest = {
      setKeys: (codes) => this.setKeys(codes),
      start: () => this.start(),
      getBallX: () => this.ballU,
      getGrounded: () => this.grounded,
      getSpeed: () => this.speed,
      getPhase: () => this.phase,
      getMeters: () => this.meters,
      getLead: () => this.nearestLead(),
      getTilt: () => this.angle,
      getBallV: () => this.ballV,
    };
  }

          bind() {
    const opt = { signal: this.ac.signal };
    window.addEventListener(
      "keydown",
      (e) => {
        const gameKey =
          e.code === "ArrowLeft" ||
          e.code === "ArrowRight" ||
          e.code === "ArrowUp" ||
          e.code === "Space" ||
          e.code === "KeyA" ||
          e.code === "KeyD" ||
          e.code === "KeyW" ||
          e.code === "Enter" ||
          e.code === "KeyP" ||
          e.code === "KeyM" ||
          e.code === "Escape";
        if (!gameKey) return;
        e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code);
      },
      opt,
    );
    window.addEventListener(
      "keyup",
      (e) => {
        this.keys.delete(e.code);
      },
      opt,
    );
    window.addEventListener("blur", () => this.pauseOnLeave(), opt);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.pauseOnLeave();
          this.last = performance.now();
        }
      },
      opt,
    );
    const parent = this.canvas.parentElement;
    if (parent) {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(parent);
      this.ac.signal.addEventListener("abort", () => ro.disconnect());
    }
  }

          pauseOnLeave() {
    this.releaseAll();
    if ((this.phase === "play" || this.phase === "fall") && !this.paused) {
      this.paused = true;
      this.emit();
    }
  }

          releaseAll() {
    this.keys.clear();
    this.pointer.left = false;
    this.pointer.right = false;
    this.pointer.jump = false;
  }

          resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    if (w > h * 1.05) {
      this.viewH = 540;
      this.viewW = 540 * (w / h);
    } else {
      this.viewW = 460;
      this.viewH = 460 * (h / w);
    }
    this.groundY = this.viewH * 0.8;
    this.playerX = Math.min(this.viewW * 0.32, 230);
    if (this.grounded) this.feetY = this.groundY;
  }

          emit() {
    this.onHud({
      phase: this.phase,
      meters: this.meters,
      score: this.meters + this.bonus,
      best: this.best,
      reason: this.reason,
      freshBest: this.freshBest,
      combo: this.combo,
      paused: this.paused,
      muted: this.muted,
    });
  }

          unlockAudio() {
    const AC =
      window.AudioContext ||
      (window                                                           ).webkitAudioContext;
    if (!AC) return;
    if (!this.audioCtx) this.audioCtx = new AC();
    if (this.audioCtx.state === "suspended") void this.audioCtx.resume();
    if (!this.noiseBuf) {
      const n = Math.floor(this.audioCtx.sampleRate * 0.2);
      const buf = this.audioCtx.createBuffer(1, n, this.audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
  }

          tone(freq        , dur        , type                , gain        , slide = 0) {
    if (this.muted) return;
    const ctx = this.audioCtx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

          noise(dur        , gain        ) {
    if (this.muted) return;
    const ctx = this.audioCtx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

          startRun() {
    this.phase = "play";
    this.reason = "";
    this.freshBest = false;
    this.bestAtStart = this.best;
    this.meters = 0;
    this.bonus = 0;
    this.runScroll = 0;
    this.cam = 0;
    this.time = 0;
    this.walkPhase = 0;
    this.prevSin = 0;
    this.speed = tuneAt(0).speed;
    this.feetY = this.groundY;
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.buffer = 0;
    this.angle = 0;
    this.visualAngle = 0;
    this.ballU = (Math.random() - 0.5) * 10;
    this.ballV = 0;
    this.roll = 0;
    this.squash = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.fallT = 0;
    this.crashLean = 0;
    this.combo = 0;
    this.paused = false;
    this.wind = 0;
    this.windDir = 0;
    this.windTime = 0;
    this.windWarning = 0;
    this.windStrength = 0;
    this.passedFlag = false;
    this.spawnCursor = this.viewW + 980;
    for (const o of this.obstacles) o.alive = false;
    for (const p of this.particles) p.alive = false;
    for (const f of this.floaters) f.alive = false;
    this.prevJump = true;
    this.emit();
  }

          die(reason             ) {
    if (this.phase === "dead") return;
    this.phase = "dead";
    this.reason = reason;
    this.paused = false;
    this.freshBest = this.meters > this.bestAtStart && this.meters > 0;
    if (this.meters > this.best) {
      this.best = this.meters;
      saveBest(this.best);
    }
    if (reason === "crash") {
      this.shake = 8;
      this.hitstop = 0.07;
      this.crashLean = 0.7;
      this.tone(140, 0.18, "sawtooth", 0.05, -80);
      this.noise(0.16, 0.08);
      this.burst(this.playerX, this.feetY - 30, "spark", 10);
    } else {
      this.tone(320, 0.28, "triangle", 0.05, -220);
    }
    if (this.freshBest) {
      this.tone(520, 0.12, "sine", 0.05);
      this.tone(680, 0.16, "sine", 0.04);
    }
    this.emit();
  }

          frame = (now        ) => {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (!document.hidden) {
      this.acc += dt;
      const step = 1 / 60;
      let n = 0;
      while (this.acc >= step && n < 6) {
        this.update(step);
        this.acc -= step;
        n++;
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

          wantsLeft() {
    return this.pointer.left || this.keys.has("ArrowLeft") || this.keys.has("KeyA");
  }

          wantsRight() {
    return this.pointer.right || this.keys.has("ArrowRight") || this.keys.has("KeyD");
  }

          wantsJump() {
    return (
      this.pointer.jump ||
      this.keys.has("Space") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("KeyW")
    );
  }

          update(dt        ) {
    this.pollSystemKeys();
    if (this.paused && (this.phase === "play" || this.phase === "fall")) return;

    this.time += dt;
    this.shake *= Math.exp(-3.4 * dt);
    this.squash += (0 - this.squash) * (1 - Math.exp(-8 * dt));
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    const jumpDown = this.wantsJump();
    const jumpEdge = jumpDown && !this.prevJump;
    const jumpRelease = !jumpDown && this.prevJump;
    const enterEdge = this.keys.has("Enter");
    this.prevJump = jumpDown;

    if ((this.phase === "menu" || this.phase === "dead") && (jumpEdge || enterEdge)) {
      this.unlockAudio();
      this.startRun();
      return;
    }

    if (this.phase === "menu") {
      this.updateMenu(dt);
      return;
    }
    if (this.phase === "dead") return;

    const tune = tuneAt(this.meters);
    this.speed = tune.speed;

    if (this.phase === "play") {
      let target = 0;
      if (this.wantsLeft() && !this.wantsRight()) target = -0.36;
      else if (this.wantsRight() && !this.wantsLeft()) target = 0.36;
      this.angle += (target - this.angle) * (1 - Math.exp(-16 * dt));

      if (jumpEdge) this.buffer = 0.14;
      else this.buffer = Math.max(0, this.buffer - dt);

      if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
        this.vy = JUMP_V;
        this.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        this.squash = 0.8;
        this.tone(420, 0.09, "sine", 0.04, 180);
      }
      if (jumpRelease && this.vy < -80) this.vy *= 0.45;
    }

    this.vy += GRAVITY * dt;
    if (this.vy > 900) this.vy = 900;
    this.feetY += this.vy * dt;
    if (this.feetY >= this.groundY) {
      const impact = this.vy;
      const wasAir = !this.grounded;
      this.feetY = this.groundY;
      this.vy = 0;
      this.grounded = true;
      this.coyote = 0.1;
      if (wasAir && impact > 200 && this.phase === "play") {
        this.shake = Math.min(5, impact * 0.004);
        this.squash = 1;
        this.ballV += Math.sin(this.visualAngle) * impact * 0.22;
        this.burst(this.playerX, this.groundY, "dust", 5);
        this.noise(0.07, 0.04);
        this.tone(96, 0.06, "sine", 0.03);
      }
    } else {
      this.grounded = false;
      this.coyote -= dt;
    }

    const cadence = this.grounded ? 7.6 + this.speed * 0.012 : 1.4;
    this.walkPhase += cadence * dt;
    const s = Math.sin(this.walkPhase);
    let kick = 0;
    if (this.phase === "play" && this.grounded && this.prevSin * s < 0) {
      const foot = Math.sign(s || 1);
      kick = foot * tune.kick + Math.sin(this.time * 0.35) * tune.bias;
      this.burst(this.playerX - 6, this.groundY, "dust", 2);
      this.tone(150 + Math.abs(foot) * 20, 0.03, "triangle", 0.016);
    }
    this.prevSin = s;

    if (this.phase === "play") {
      this.updateWind(dt);
      this.integrateBall(dt, tune, kick);
      this.roll += (this.ballV / BALL_R) * dt;
      if (Math.abs(this.ballU) > BALL_LIMIT) this.beginFall();
    } else {
      this.fallT += dt;
      this.fallVy += GRAVITY * dt;
      this.fallX += this.fallVx * dt;
      this.fallY += this.fallVy * dt;
      this.roll += this.fallVx * 0.01 * dt;
      if (this.fallT > 0.72) this.die("ball");
    }

    this.cam += this.speed * dt;
    this.runScroll += this.speed * dt;
    const nextMeters = Math.floor(this.runScroll / 46);
    if (nextMeters !== this.meters) {
      this.meters = nextMeters;
      if (this.meters > this.best) {
        this.best = this.meters;
        saveBest(this.best);
      }
      this.emit();
    }

    if (this.phase === "play") {
      this.spawnObstacles(tune);
      this.collide();
      this.scorePasses();
      this.watchFlag();
    }
    this.updateParticles(dt);
    const leafChance = this.windDir !== 0 ? 2.4 : 0.8;
    if (Math.random() < dt * leafChance) this.spawnLeaf();
  }

          updateMenu(dt        ) {
    this.speed = 48;
    this.cam += this.speed * dt;
    this.walkPhase += 6.2 * dt;
    this.feetY = this.groundY;
    this.grounded = true;
    this.vy = 0;
    const assist = clamp(-this.ballU * 0.038 - this.ballV * 0.014, -0.28, 0.28);
    this.angle += (assist - this.angle) * (1 - Math.exp(-8 * dt));
    const s = Math.sin(this.walkPhase);
    const kick = this.prevSin * s < 0 ? Math.sign(s || 1) * 30 : 0;
    this.prevSin = s;
    this.integrateBall(dt, { speed: 48, ballG: 520, kick: 0, gait: 0.08, bias: 0, damp: 1.1 }, kick);
    if (Math.abs(this.ballU) > BALL_LIMIT * 0.62) {
      this.ballU = Math.sign(this.ballU) * BALL_LIMIT * 0.62;
      this.ballV *= -0.2;
    }
    this.roll += (this.ballV / BALL_R) * dt;
    this.updateParticles(dt);
    if (Math.random() < dt * 0.5) this.spawnLeaf();
  }

          integrateBall(dt        , tune      , kick        ) {
    const gait = Math.sin(this.walkPhase) * (this.grounded ? tune.gait : tune.gait * 0.25);
    this.visualAngle = this.angle + gait;
    const acc = Math.sin(this.visualAngle) * tune.ballG;
    this.ballV += kick;
    this.ballV += acc * dt;
    this.ballV += this.wind * dt;
    this.ballV *= Math.exp(-tune.damp * dt);
    this.ballU += this.ballV * dt;
  }

          beginFall() {
    const p = this.boardPoint(this.ballU, -(BOARD_THICK / 2 + BALL_R));
    this.fallX = this.cam + p.x;
    this.fallY = p.y;
    this.fallVx = this.speed + Math.cos(this.visualAngle) * this.ballV;
    this.fallVy = Math.sin(this.visualAngle) * this.ballV - 30;
    this.fallT = 0;
    this.phase = "fall";
    this.tone(360, 0.22, "sine", 0.045, -200);
    this.emit();
  }

          spawnObstacles(tune      ) {
    while (this.spawnCursor < this.cam + this.viewW + 40) {
      const slot = this.obstacles.find((o) => !o.alive);
      if (!slot) break;
      const kind = OBSTACLE_KINDS[Math.floor(Math.random() * OBSTACLE_KINDS.length)] ;
      const spec = obstacleSpec(kind);
      slot.alive = true;
      slot.kind = kind;
      slot.w = spec.w;
      slot.h = spec.h;
      slot.x = this.spawnCursor;
      slot.scored = false;
      const gap = slot.w + tune.speed * 1.55 + 110 + Math.random() * 140;
      this.spawnCursor += gap;
    }
    for (const o of this.obstacles) {
      if (o.alive && o.x + o.w < this.cam - 80) o.alive = false;
    }
  }

          nearestLead() {
    const px = this.playerWorldX();
    let best = 9999;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      const lead = o.x - px;
      if (lead > -o.w && lead < best) best = lead;
    }
    return best;
  }

          playerWorldX() {
    return this.cam + this.playerX;
  }

          collide() {
    const left = this.playerWorldX() - 10;
    const right = this.playerWorldX() + 12;
    const bottom = this.feetY - 2;
    const top = this.feetY - 64;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      const oTop = this.groundY - o.h;
      if (right < o.x || left > o.x + o.w) continue;
      if (bottom < oTop + 18) continue;
      if (top > this.groundY) continue;
      this.die("crash");
      return;
    }
  }

          scorePasses() {
    const px = this.playerWorldX();
    for (const o of this.obstacles) {
      if (!o.alive || o.scored) continue;
      if (o.x + o.w < px - 16) {
        o.scored = true;
        const perfect = Math.abs(this.ballU) < BALL_LIMIT * 0.15;
        if (perfect) {
          this.combo += 1;
          const pts = 4 + this.combo * 2;
          this.bonus += pts;
          this.spawnFloater(`完美 ×${this.combo}  +${pts}`);
          const pitch = 460 + Math.min(this.combo, 10) * 32;
          this.tone(pitch, 0.09, "square", 0.035);
          const b = this.boardPoint(this.ballU, -(BOARD_THICK / 2 + BALL_R));
          this.burst(b.x, b.y, "gold", 8);
        } else {
          this.combo = 0;
          this.bonus += 2;
          this.spawnFloater("通过 +2");
        }
        this.emit();
      }
    }
  }

          updateWind(dt        ) {
    if (this.meters < 80) {
      this.wind = 0;
      this.windDir = 0;
      return;
    }
    if (this.windWarning > 0) {
      this.windWarning = Math.max(0, this.windWarning - dt);
      this.wind = 0;
      return;
    }
    this.windTime -= dt;
    if (this.windTime <= 0) {
      this.windDir = Math.random() < 0.22 ? 0 : Math.random() < 0.5 ? -1 : 1;
      this.windStrength = 80 + Math.min(90, (this.meters - 80) * 0.35);
      this.windTime = this.windDir === 0 ? 1.3 : 2.2 + Math.random() * 1.5;
      this.windWarning = this.windDir === 0 ? 0 : 1.2;
      this.wind = 0;
      return;
    }
    const target = this.windDir * this.windStrength;
    this.wind += (target - this.wind) * (1 - Math.exp(-3 * dt));
  }

          watchFlag() {
    if (this.passedFlag || this.bestAtStart < 8) return;
    if (this.runScroll <= this.bestAtStart * 46) return;
    this.passedFlag = true;
    this.spawnFloater("超越纪录");
    this.tone(640, 0.12, "sine", 0.045);
    this.tone(820, 0.14, "sine", 0.03);
  }

          pollSystemKeys() {
    const pause = this.keys.has("KeyP") || this.keys.has("Escape");
    const mute = this.keys.has("KeyM");
    if (pause && !this.prevPause && (this.phase === "play" || this.phase === "fall")) {
      this.paused = !this.paused;
      if (this.paused) this.releaseAll();
      this.emit();
    }
    if (mute && !this.prevMute) {
      this.muted = !this.muted;
      this.emit();
    }
    this.prevPause = pause;
    this.prevMute = mute;
  }

          burst(x        , y        , kind                  , n        ) {
    let left = n;
    for (const p of this.particles) {
      if (p.alive || left <= 0) continue;
      left--;
      p.alive = true;
      p.kind = kind;
      p.x = this.cam + x + (Math.random() - 0.5) * 10;
      p.y = y;
      p.vx = (Math.random() - 0.6) * 80;
      p.vy = -40 - Math.random() * 90;
      p.life = 0.35 + Math.random() * 0.35;
      p.max = p.life;
      p.size = kind === "spark" ? 2 + Math.random() * 2 : 3 + Math.random() * 3;
    }
  }

          spawnLeaf() {
    const p = this.particles.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.kind = "leaf";
    p.x = this.cam + this.viewW + 10;
    p.y = this.groundY * (0.15 + Math.random() * 0.55);
    p.vx = -20 - Math.random() * 30 + this.wind * 0.4;
    p.vy = 12 + Math.random() * 20;
    p.life = 4;
    p.max = 4;
    p.size = 3 + Math.random() * 2;
  }

          spawnFloater(text        ) {
    const f = this.floaters.find((q) => !q.alive) ?? this.floaters[0] ;
    f.alive = true;
    f.text = text;
    f.x = this.playerX;
    f.y = this.feetY - 120;
    f.life = 0.9;
  }

          updateParticles(dt        ) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== "leaf") p.vy += 280 * dt;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.life -= dt;
      f.y -= 28 * dt;
      if (f.life <= 0) f.alive = false;
    }
  }

          boardPoint(along        , normalUp        ) {
    const a = this.visualAngle;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = this.playerX + 2;
    const cy = this.boardCenterY();
    return {
      x: cx + ca * along - sa * normalUp,
      y: cy + sa * along + ca * normalUp,
    };
  }

          boardCenterY() {
    const bob = this.grounded ? Math.sin(this.walkPhase * 2) * 2.2 : 0;
    const lean = this.phase === "dead" && this.reason === "crash" ? 8 : 0;
    return this.feetY - 118 + bob + lean;
  }

          makeGrain() {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 160;
    const g = c.getContext("2d");
    if (!g) return;
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = 36;
      img.data[i + 1] = 32;
      img.data[i + 2] = 28;
      img.data[i + 3] = v > 0.86 ? 36 : v < 0.06 ? 22 : 0;
    }
    g.putImageData(img, 0, 0);
    this.grain = this.ctx.createPattern(c, "repeat");
  }

          draw() {
    const ctx = this.ctx;
    const sx = (this.cssW / this.viewW) * this.dpr;
    const sy = (this.cssH / this.viewH) * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const jx = (Math.random() - 0.5) * this.shake * sx;
    const jy = (Math.random() - 0.5) * this.shake * sy;
    ctx.setTransform(sx, 0, 0, sy, jx, jy);

    this.drawSky();
    if (this.forestArt?.complete && this.forestArt.naturalWidth) {
      const height = this.groundY;
      const width = height * this.forestArt.naturalWidth / this.forestArt.naturalHeight;
      const offset = (this.cam * 0.22) % width;
      // Alternate mirrored tiles so both joins share the exact same edge.
      const tile = Math.floor(this.cam * 0.22 / width);
      for(let i=0;i<Math.ceil(this.viewW/width)+1;i++){
        ctx.save();ctx.translate(i*width-offset,0);
        if((tile+i)%2){ctx.translate(width,0);ctx.scale(-1,1);}
        ctx.drawImage(this.forestArt,0,0,width,height);ctx.restore();
      }
    } else {
      this.drawHills();this.drawForest(0.18,true);this.drawForest(0.42,false);
    }
    this.drawGround();
    this.drawParticles(false);
    for (const o of this.obstacles) if (o.alive) this.drawObstacle(o);
    this.drawRunner();
    if (this.phase === "fall" || (this.phase === "dead" && this.reason === "ball")) {
      this.drawBall(this.fallX - this.cam, this.fallY, this.roll);
    }
    if(this.propFrames.length){
      const offset=this.cam*1.12;
      for(let wx=Math.floor(offset/230)*230;wx<offset+this.viewW+230;wx+=230){
        const index=4+Math.floor(hash(wx)*3),h=38+hash(wx+2)*26;
        this.drawProp(index,wx-offset,this.viewH-h,90,h);
      }
    }
    this.drawParticles(true);
    this.drawFlag();
    if (this.grain) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = this.grain;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();
    }
    this.drawFloaters();
    this.drawWind();
    this.drawDanger();
  }

        drawSky() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
    g.addColorStop(0, "#f6f3df");
    g.addColorStop(0.62, "#f6f3df");
    g.addColorStop(1, "#edeed7");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const sunX = this.viewW * 0.73;
    const sunY = this.groundY * 0.32;
    const glow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 110);
    glow.addColorStop(0, "rgba(224,122,95,0.22)");
    glow.addColorStop(0.45, "rgba(228,201,154,0.16)");
    glow.addColorStop(1, "rgba(228,201,154,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const x = ((i * 280 + 40 - this.cam * 0.05) % (this.viewW + 240)) - 80;
      const y = this.groundY * (0.16 + hash(i + 2) * 0.16);
      this.cloud(x, y, 0.85 + hash(i + 8) * 0.45);
    }
  }

          cloud(x        , y        , s        ) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,252,247,0.88)";
    ctx.beginPath();
    ctx.moveTo(x - 22 * s, y + 4 * s);
    ctx.quadraticCurveTo(x - 26 * s, y - 12 * s, x - 8 * s, y - 8 * s);
    ctx.quadraticCurveTo(x - 2 * s, y - 24 * s, x + 12 * s, y - 10 * s);
    ctx.quadraticCurveTo(x + 30 * s, y - 16 * s, x + 24 * s, y + 2 * s);
    ctx.quadraticCurveTo(x + 8 * s, y + 12 * s, x - 22 * s, y + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }

          drawHills() {
    const ctx = this.ctx;
    const ridge = (parallax        , fill        , amp        , base        ) => {
      const y0 = this.groundY - base;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= this.viewW + 24; x += 18) {
        const wx = this.cam * parallax + x;
        const y = y0 - Math.sin(wx * 0.01) * amp - Math.sin(wx * 0.023 + 1.2) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.lineTo(this.viewW, this.viewH);
      ctx.lineTo(0, this.viewH);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    ridge(0.08, "#d6c9e5", 28, 36);
    ridge(0.16, "#bde2d2", 18, 8);
  }

          drawForest(parallax        , far         ) {
    const spacing = far ? 240 : 320;
    const origin = this.cam * parallax;
    const start = Math.floor(origin / spacing) * spacing - spacing;
    for (let wx = start; wx < origin + this.viewW + spacing; wx += spacing) {
      const j = hash(wx + (far ? 3 : 19));
      const sx = wx - origin + (j - 0.5) * 40;
      const h = (far ? 220 : 280) * (0.85 + j * 0.28);
      this.inkTree(sx, this.groundY - (far ? 10 : 2), h, wx, far);
    }
  }

          inkTree(x        , gy        , h        , seed        , far         ) {
    const c = this.ctx;
    const pine = hash(seed + 9) > 0.4;
    c.save(); c.strokeStyle = far ? '#869b99' : INK; c.lineWidth = far ? 1 : 1.8;
    c.fillStyle = far ? '#c8bfdf' : '#b5a0cd';
    c.beginPath(); c.moveTo(x-9,gy); c.lineTo(x-5,gy-h); c.lineTo(x+6,gy-h+8); c.lineTo(x+12,gy); c.closePath(); c.fill(); c.stroke();
    if (pine) {
      c.fillStyle = far ? '#abd6cb' : '#62c0ae'; c.beginPath(); c.moveTo(x,gy-h-28);
      for(let j=1;j<=5;j++){const y=gy-h-28+j*h*.15;c.lineTo(x-j*9,y);c.lineTo(x-j*6,y-5);}
      c.lineTo(x-4,gy-30);c.lineTo(x+6,gy-30);
      for(let j=5;j>=1;j--){const y=gy-h-28+j*h*.15;c.lineTo(x+j*9,y);c.lineTo(x+j*6,y-8);}
      c.closePath();c.fill();c.stroke();
    }
    c.beginPath();
    for(let j=0;j<55;j++){const t=hash(seed+j*3), yy=gy-18-t*(h-18);const width=pine?(1-t)*32:7;const xx=x+(hash(seed+j*13)-.5)*width*2;c.moveTo(xx,yy);c.lineTo(xx+1,yy+3+hash(j)*4);}
    c.stroke();
    if(!far&&!pine)for(let j=1;j<4;j++)this.mushroom(x+10,gy-h*j*.2,true);
    c.restore();
  }

          atlasFrames(img                  , cols        , rows        ) {
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d') ;ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const cw=canvas.width/cols,ch=canvas.height/rows,result           =[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const edges=cols===4?(row===0?[0,432,752,1144,canvas.width]:[0,406,772,1144,canvas.width]):Array.from({length:cols+1},(_,i)=>i*cw);
      const left=edges[col] ,right=edges[col+1] ;
      let l=right,t=(row+1)*ch,r=left,b=row*ch;
      for(let y=row*ch;y<(row+1)*ch;y++)for(let x=left;x<right;x++)if(pixels[(y*canvas.width+x)*4+3]>180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
      result.push([l,t,r-l+1,b-t+1]);
    }return result;
  }

          drawProp(index       ,x       ,y       ,w       ,h       ) {
    const f=this.propFrames[index];if(!f)return;
    this.ctx.drawImage(this.propsArt,f[0] ,f[1] ,f[2] ,f[3] ,x,y,w,h);
  }

          drawGround() {
    if(this.groundArt.complete && this.groundArt.naturalWidth){
      const c=this.ctx, h=this.viewH-this.groundY, w=h*2.8;
      const offset=this.cam%w, tile=Math.floor(this.cam/w);
      for(let i=0;i<Math.ceil(this.viewW/w)+1;i++){
        c.save();c.translate(i*w-offset,this.groundY);if((tile+i)%2){c.translate(w,0);c.scale(-1,1);}
        c.drawImage(this.groundArt,0,420,1536,544,0,0,w,h);c.restore();
      }
      return;
    }
    const c=this.ctx, y=this.groundY;
    c.fillStyle='#efaaa9'; c.fillRect(0,y,this.viewW,this.viewH-y);
    const start=Math.floor(this.cam/12)*12-12;
    c.fillStyle='#c6df50';c.strokeStyle=INK;c.lineWidth=1.7;
    c.beginPath();c.moveTo(-20,y);c.lineTo(this.viewW+20,y);
    for(let wx=Math.ceil((this.cam+this.viewW+24)/12)*12;wx>=start;wx-=12){const x=wx-this.cam;c.lineTo(x+8,y+12+hash(wx)*5);c.lineTo(x+5,y+27+hash(wx+1)*9);c.lineTo(x+2,y+15);c.lineTo(x,y+20);}
    c.closePath();c.fill();c.stroke();
    c.lineWidth=.9;c.beginPath();
    for(let wx=start;wx<this.cam+this.viewW+20;wx+=12){const x=wx-this.cam;c.moveTo(x,y+4);c.lineTo(x+1,y+7);
      for(let j=0;j<7;j++){const yy=y+35+hash(wx+j*17)*(this.viewH-y-35);const xx=x+hash(wx+j)*10;c.moveTo(xx,yy);c.lineTo(xx+1,yy+2+hash(wx-j)*6);}}
    c.stroke();
    for(let wx=Math.floor(this.cam/85)*85-85;wx<this.cam+this.viewW+85;wx+=85){const x=wx-this.cam;
      if(hash(wx)>.5)this.mushroom(x,y-2,true);
      if(hash(wx+3)>.35){c.strokeStyle=INK;this.tuft(x+20,y-1,10+hash(wx)*12);}
      if(hash(wx+8)>.65){c.fillStyle=WASH;c.beginPath();c.moveTo(x,y+65);c.lineTo(x+12,y+41);c.lineTo(x+22,y+48);c.lineTo(x+28,y+68);c.closePath();c.fill();c.stroke();}}
  }

          tuft(x        , y        , h        ) {
    const ctx = this.ctx;
    ctx.strokeStyle = SAGE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 3, y - h * 0.6, x - 5, y - h);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 1, y - h * 0.7, x + 1, y - h - 2);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - h * 0.5, x + 7, y - h + 1);
    ctx.stroke();
  }

          pebble(x        , y        ) {
    const ctx = this.ctx;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 3.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

          mushroom(x        , y        , coral         ) {
    const ctx = this.ctx;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 8);
    ctx.stroke();
    ctx.fillStyle = coral ? CORAL : WASH;
    ctx.beginPath();
    ctx.ellipse(x, y - 9, 6, 3.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  }

          drawObstacle(o          ) {
    if(this.propFrames.length){
      const index={stump:0,crate:1,rock:2,fence:3}[o.kind];
      this.drawProp(index,o.x-this.cam,this.groundY-o.h,o.w,o.h);return;
    }
    const c=this.ctx,x=o.x-this.cam,y=this.groundY,w=o.w,h=o.h;
    c.save();c.translate(x,y);c.strokeStyle=INK;c.lineWidth=2;c.lineJoin='round';
    if(o.kind==='stump'){
      c.fillStyle='#dc929c';c.beginPath();c.moveTo(0,0);c.lineTo(7,-8);c.lineTo(10,-h+4);c.quadraticCurveTo(w/2,-h-2,w-8,-h+4);c.lineTo(w-6,-7);c.lineTo(w,0);c.closePath();c.fill();c.stroke();
      c.lineWidth=1;c.beginPath();for(let i=0;i<9;i++){let xx=9+i*(w-18)/8;c.moveTo(xx,-h+8);c.quadraticCurveTo(xx-3,-h/2,xx+(i%2?4:-4),-3);}c.stroke();
      c.fillStyle='#c7dc4d';c.beginPath();c.moveTo(9,-h+3);c.quadraticCurveTo(w/2,-h-4,w-8,-h+3);c.lineTo(w-7,-h+11);for(let i=w-9;i>10;i-=5){c.lineTo(i,-h+6);c.lineTo(i-2,-h+14);}c.closePath();c.fill();c.stroke();
    }else if(o.kind==='crate'){
      c.fillStyle='#efd45d';c.beginPath();c.moveTo(1,0);c.lineTo(0,-h);c.lineTo(w-2,-h+1);c.lineTo(w,0);c.closePath();c.fill();c.stroke();c.strokeRect(5,-h+5,w-10,h-10);
      for(let i=10;i<w-5;i+=8){c.lineWidth=.8;c.beginPath();c.moveTo(i,-h+6);c.lineTo(i+1,-6);c.stroke();}
      c.lineWidth=7;c.beginPath();c.moveTo(7,-7);c.lineTo(w-7,-h+7);c.stroke();c.strokeStyle='#ffe47c';c.lineWidth=4;c.stroke();c.strokeStyle=INK;
      for(let i=0;i<28;i++){let xx=3+hash(i+o.x)*(w-6),yy=-h+3+hash(i*5)*(h-6);c.fillRect(xx,yy,2,.7);}
      for(const xx of [3,w-4])for(const yy of [-h+3,-4]){c.beginPath();c.arc(xx,yy,1.2,0,7);c.fillStyle=INK;c.fill();}
    }else if(o.kind==='rock'){
      c.fillStyle=WASH;c.beginPath();c.moveTo(0,0);c.lineTo(8,-h*.7);c.lineTo(w*.45,-h);c.lineTo(w*.8,-h*.8);c.lineTo(w,0);c.closePath();c.fill();c.stroke();
      c.lineWidth=1;c.beginPath();for(let i=0;i<22;i++){let xx=10+hash(i)*(w-20),yy=-5-hash(i+10)*(h-12);c.moveTo(xx,yy);c.lineTo(xx+1,yy+3);}c.stroke();
    }else{
      c.fillStyle=WOOD;for(const xx of [3,w-10]){c.fillRect(xx,-h,7,h);c.strokeRect(xx,-h,7,h);}
      for(const yy of [-h+4,-h*.45]){c.fillRect(0,yy,w,7);c.strokeRect(0,yy,w,7);c.lineWidth=.8;c.beginPath();for(let j=5;j<w-3;j+=9){c.moveTo(j,yy+3);c.lineTo(j+5,yy+4);}c.stroke();}
    }
    c.restore();
  }

          drawHeroSprite() {
    // Registration is authored in atlas-cell pixels, never in changing alpha bounds.
    const cellW=this.heroArt.naturalWidth/3,cellH=this.heroArt.naturalHeight/2;
    const unit=cellH/512, scale=118/(405*unit);
    const anchorX=[315,303,296,305,312,312];
    const baseline=470*unit;
    const drawPart=(frame       ,top       ,bottom       )=>{
      const col=frame%3,row=Math.floor(frame/3);
      const h=(bottom-top)*unit;
      this.ctx.drawImage(this.heroArt,col*cellW,row*cellH+top*unit,cellW,h,
        this.playerX-anchorX[frame] *unit*scale,
        this.feetY+(top*unit-baseline)*scale,cellW*scale,h*scale);
    };
    if(this.phase==='dead'||this.phase==='fall'){drawPart(5,0,512);return;}
    if(!this.grounded){drawPart(3,0,512);return;}
    const c=this.ctx;
    for(const side of [-1,1]){
      const leg=walkingLeg(this.walkPhase,side);
      c.save();c.translate(this.playerX,this.feetY);
      c.lineCap='round';c.lineJoin='round';c.beginPath();
      c.moveTo(leg.hipX,leg.hipY);c.lineTo(leg.kneeX,leg.kneeY);c.lineTo(leg.footX,leg.footY);
      c.strokeStyle=INK;c.lineWidth=6;c.stroke();
      c.strokeStyle=side===-1?'#dc8cad':CORAL;c.lineWidth=3.5;c.stroke();
      // Short pen strokes keep the articulated limbs consistent with the ink artwork.
      c.lineWidth=.65;c.strokeStyle=INK;c.beginPath();
      for(const [ax,ay,bx,by] of [[leg.hipX,leg.hipY,leg.kneeX,leg.kneeY],[leg.kneeX,leg.kneeY,leg.footX,leg.footY]]){
        c.moveTo(ax+(bx-ax)*.4,ay+(by-ay)*.4);c.lineTo(ax+(bx-ax)*.47,ay+(by-ay)*.47);
      }c.stroke();
      // Isolate just the right boot, excluding the neighbouring boot and all leg pixels.
      c.drawImage(this.heroArt,810*unit,914*unit,69*unit,51*unit,leg.footX-4,leg.footY-5,18,13);
      c.restore();
    }
    // The standing torso has no outstretched old leg pixels below its ragged hem.
    drawPart(4,0,340);
  }

          drawRunner() {
    if(this.heroFrames.length){
      this.drawHeroSprite();
      this.drawBoard();
      if(this.phase==='menu'||this.phase==='play'||this.reason==='crash'){const b=this.boardPoint(this.ballU,-(BOARD_THICK/2+BALL_R));this.drawBall(b.x,b.y,this.roll);}
      return;
    }
    const c=this.ctx,x=this.playerX,y=this.feetY;
    const bob=this.grounded?Math.sin(this.walkPhase*2)*1.5:0;
    const hip=y-35+bob, shoulder=y-66+bob, head=y-83+bob;
    const swing=this.grounded?Math.sin(this.walkPhase):.8;
    const limb=(points           )=>{c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.strokeStyle=INK;c.lineWidth=6;c.stroke();c.strokeStyle=CORAL;c.lineWidth=3;c.stroke();};
    c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle=INK;c.lineWidth=1.8;
    const boot=(bx       ,by       ,rotation       )=>{c.save();c.translate(bx,by);c.rotate(rotation);c.fillStyle=INK;c.beginPath();c.moveTo(-4,-12);c.lineTo(3,-12);c.lineTo(4,-4);c.lineTo(13,-4);c.lineTo(14,0);c.lineTo(-4,0);c.closePath();c.fill();c.strokeStyle=PAPER;c.lineWidth=.6;for(let j=0;j<6;j++){c.beginPath();c.moveTo(-2+j*2,-3);c.lineTo(-1+j*2,-1);c.stroke();}c.restore();};
    for(const side of [-1,1]){const footX=x+side*swing*25,footY=y-(this.grounded?Math.max(0,-side*swing)*8:10);limb([[x+side*3,hip],[x+side*swing*12,hip+19],[footX,footY-5]]);boot(footX,footY,-side*swing*.3);}
    const left=this.boardPoint(-52,BOARD_THICK/2+2),right=this.boardPoint(50,BOARD_THICK/2+2);
    limb([[x-6,shoulder],[x-27,shoulder-20],[left.x,left.y]]);
    // Swept triangular tunic with a broken, pointed hem.
    c.fillStyle=SAGE;c.strokeStyle=INK;c.lineWidth=1.8;c.beginPath();c.moveTo(x+8,shoulder-3);c.lineTo(x-9,shoulder+2);c.lineTo(x-34,hip+3);c.lineTo(x-23,hip+1);c.lineTo(x-27,hip+8);c.lineTo(x-15,hip+4);c.lineTo(x-16,hip+10);c.lineTo(x-5,hip+5);c.lineTo(x+1,hip+9);c.lineTo(x+12,hip+3);c.closePath();c.fill();c.stroke();
    c.lineWidth=.8;c.beginPath();for(let i=0;i<24;i++){const xx=x-21+hash(i)*28,yy=shoulder+10+hash(i+5)*22;c.moveTo(xx,yy);c.lineTo(xx-2,yy+3);}c.stroke();
    c.fillStyle=PAPER;c.lineWidth=1.8;c.beginPath();c.ellipse(x+4,head+2,11,21,-.12,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle=CORAL;c.beginPath();c.moveTo(x+10,head-3);c.lineTo(x+42,head-3);c.lineTo(x+41,head+5);c.lineTo(x+10,head+5);c.closePath();c.fill();c.stroke();
    c.fillStyle=SAGE;c.beginPath();c.moveTo(x-13,head-4);c.quadraticCurveTo(x-12,head-28,x+5,head-25);c.quadraticCurveTo(x+18,head-24,x+18,head-10);c.lineTo(x+4,head-15);c.lineTo(x-19,head-3);c.lineTo(x-22,head+4);c.closePath();c.fill();c.stroke();
    c.fillStyle=WOOD;c.beginPath();c.arc(x-22,head+5,3,0,7);c.fill();c.stroke();
    c.fillStyle=PAPER;c.beginPath();c.ellipse(x+9,head-7,3,4,0,0,7);c.fill();c.stroke();c.fillStyle=INK;c.beginPath();c.arc(x+10,head-7,1.2,0,7);c.fill();
    c.lineWidth=.8;c.beginPath();for(let i=0;i<18;i++){const xx=x-8+hash(i)*21,yy=head-19+hash(i+22)*5;c.moveTo(xx,yy);c.lineTo(xx+1,yy+2);}for(let i=0;i<9;i++){const xx=x-1+hash(i)*9,yy=head+9+hash(i+8)*9;c.moveTo(xx,yy);c.lineTo(xx,yy+1);}c.stroke();
    limb([[x+8,shoulder],[x+25,shoulder-18],[right.x,right.y]]);
    this.drawBoard();
    if(this.phase==='menu'||this.phase==='play'||this.reason==='crash'){const b=this.boardPoint(this.ballU,-(BOARD_THICK/2+BALL_R));this.drawBall(b.x,b.y,this.roll);}
    this.drawHand(left.x,left.y);this.drawHand(right.x,right.y);c.restore();
  }

          drawLeg(hipX        , hipY        , footX        , footY        , back         ) {
    const kneeX = (hipX + footX) / 2 + (back ? -6 : 5);
    const kneeY = (hipY + footY) / 2 + 2;
    this.inkLimb(hipX, hipY, kneeX, kneeY, 0, back ? 6 : 7);
    const ctx = this.ctx;
    ctx.strokeStyle = INK;
    ctx.lineWidth = (back ? 6 : 7) + 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = back ? 6 : 7;
    ctx.stroke();
    ctx.fillStyle = WOOD_DEEP;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    roundRect(ctx, footX - 7, footY - 3, 15, 6, 3);
    ctx.fill();
    ctx.stroke();
  }

          inkLimb(x0        , y0        , x1        , y1        , bend        , width        ) {
    const ctx = this.ctx;
    const mx = (x0 + x1) / 2 + bend * 10;
    const my = (y0 + y1) / 2 + 8;
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 3.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = width;
    ctx.stroke();
  }

          drawHand(x        , y        ) {
    const ctx = this.ctx;
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

          drawBoard() {
    if(this.propFrames.length){const c=this.ctx;c.save();c.translate(this.playerX+2,this.boardCenterY());c.rotate(this.visualAngle);this.drawProp(7,-BOARD_LEN/2,-BOARD_THICK/2,BOARD_LEN,BOARD_THICK);c.restore();return;}
    const ctx = this.ctx;
    const cx = this.playerX + 2;
    const cy = this.boardCenterY();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.visualAngle);
    ctx.fillStyle = WOOD;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    roundRect(ctx, -BOARD_LEN / 2, -BOARD_THICK / 2, BOARD_LEN, BOARD_THICK, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle=INK;
    for(let i=0;i<40;i++){const xx=-BOARD_LEN/2+10+hash(i)* (BOARD_LEN-20), yy=-4+hash(i+11)*8;ctx.fillRect(xx,yy,2+hash(i+4)*4,.7);}
    const safe = BALL_LIMIT * 0.15;
    ctx.fillStyle = "rgba(111,154,132,0.42)";
    ctx.fillRect(-safe, -BOARD_THICK / 2 + 2, safe * 2, BOARD_THICK - 4);
    ctx.strokeStyle = SAGE;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, -BOARD_THICK / 2 + 2);
    ctx.lineTo(0, BOARD_THICK / 2 - 2);
    ctx.moveTo(-safe, -BOARD_THICK / 2 + 2);
    ctx.lineTo(-safe, BOARD_THICK / 2 - 2);
    ctx.moveTo(safe, -BOARD_THICK / 2 + 2);
    ctx.lineTo(safe, BOARD_THICK / 2 - 2);
    ctx.stroke();
    const edge = clamp((Math.abs(this.ballU) - BALL_LIMIT * 0.55) / (BALL_LIMIT * 0.45), 0, 1);
    if (edge > 0 && (this.phase === "play" || this.phase === "menu")) {
      const pulse = 0.4 + Math.sin(this.time * 16) * 0.35;
      ctx.fillStyle = `rgba(224,122,95,${edge * pulse})`;
      roundRect(ctx, -BOARD_LEN / 2, -BOARD_THICK / 2, 18, BOARD_THICK, 4);
      ctx.fill();
      roundRect(ctx, BOARD_LEN / 2 - 18, -BOARD_THICK / 2, 18, BOARD_THICK, 4);
      ctx.fill();
    }
    ctx.strokeStyle = "#8d6a3e";
    ctx.lineWidth = 1.2;
    for (const gy of [-3, 2]) {
      ctx.beginPath();
      ctx.moveTo(-BOARD_LEN / 2 + 12, gy);
      ctx.lineTo(BOARD_LEN / 2 - 12, gy);
      ctx.stroke();
    }
    ctx.fillStyle = WOOD_DEEP;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    roundRect(ctx, -BOARD_LEN / 2, -BOARD_THICK / 2, 8, BOARD_THICK, 3);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, BOARD_LEN / 2 - 8, -BOARD_THICK / 2, 8, BOARD_THICK, 3);
    ctx.fill();
    ctx.stroke();
    if (this.phase === "menu" || this.phase === "play" || this.reason === "crash") {
      ctx.fillStyle = "rgba(44,44,44,0.16)";
      ctx.beginPath();
      ctx.ellipse(this.ballU, -BOARD_THICK / 2 + 1, BALL_R * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

          drawBall(x        , y        , roll        ) {
    const ctx = this.ctx;
    const danger = clamp(Math.abs(this.ballU) / BALL_LIMIT, 0, 1);
    ctx.fillStyle = danger > 0.78 ? "#ff77a9" : CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll);
    ctx.fillStyle=INK;
    for(let i=0;i<20;i++){const a=hash(i)*Math.PI*2,r=3+hash(i+14)*8;ctx.fillRect(Math.cos(a)*r,Math.sin(a)*r,.9,1.8);}
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R - 1.6, -0.85, 0.85);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255,252,247,0.95)";
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 5, 3, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

          drawParticles(front         ) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      if (!p.alive) continue;
      const isFront = p.kind !== "leaf";
      if (isFront !== front) continue;
      const x = p.x - this.cam;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.kind === "leaf") {
        ctx.fillStyle = SAGE;
        ctx.beginPath();
        ctx.ellipse(x, p.y, p.size, p.size * 0.45, this.time + x * 0.01, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "spark") {
        ctx.fillStyle = CORAL;
        ctx.fillRect(x, p.y, p.size, p.size);
      } else if (p.kind === "gold") {
        ctx.fillStyle = "#e0b44a";
        ctx.beginPath();
        ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = WASH_DEEP;
        ctx.beginPath();
        ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

          drawFlag() {
    if (this.bestAtStart < 8) return;
    if (this.phase !== "play" && this.phase !== "fall") return;
    const x = this.bestAtStart * 46 - this.cam + this.playerX;
    if (x < -40 || x > this.viewW + 40) return;
    const ctx = this.ctx;
    const y = this.groundY;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x, y - 74);
    ctx.stroke();
    ctx.fillStyle = this.passedFlag ? SAGE : CORAL;
    ctx.beginPath();
    ctx.moveTo(x, y - 74);
    ctx.lineTo(x + 26, y - 64);
    ctx.lineTo(x, y - 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "700 13px 'WenQuanYi Zen Hei', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("最佳", x + 4, y - 80);
  }

          drawNotice(text       ,x       ,y       ,color       ,size=22) {
    const c=this.ctx;c.save();c.globalAlpha=1;
    // Keep labels readable in CSS pixels on narrow and short viewports.
    const font=Math.max(size,18*this.viewW/this.cssW);
    c.font=`800 ${font}px 'Microsoft YaHei', 'PingFang SC', sans-serif`;
    const w=Math.min(this.viewW-20,c.measureText(text).width+32),h=font+24;
    x=clamp(x,w/2+8,this.viewW-w/2-8);y=clamp(y,h/2+8,this.viewH-h/2-8);
    c.translate(x-w/2,y-h/2);
    c.fillStyle=INK;c.fillRect(4,4,w,h);
    c.fillStyle=color;c.strokeStyle=INK;c.lineWidth=2.5;
    c.beginPath();c.moveTo(0,2);c.lineTo(w-3,0);c.lineTo(w,h-3);c.lineTo(2,h);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(7,6);c.lineTo(13,6);c.moveTo(w-13,h-6);c.lineTo(w-7,h-6);c.lineWidth=1;c.stroke();
    c.fillStyle=INK;c.textAlign='center';c.textBaseline='middle';
    c.fillText(text,w/2,h/2,w-20);c.restore();
  }

          drawWind() {
    if (this.phase !== "play" || this.windDir === 0) return;
    const ctx = this.ctx;
    const dir = this.windDir;
    ctx.save();
    ctx.strokeStyle = SAGE;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
      const y = 54 + i * 22;
      const span = this.viewW + 120;
      const shift = (((this.time * 220 * dir) % span) + span) % span;
      const x = dir > 0 ? shift - 60 : this.viewW - shift;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 28, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.font = "700 16px 'WenQuanYi Zen Hei', sans-serif";
    ctx.textAlign = "center";
    const label = this.windWarning > 0 ? "阵风将至" : "阵风";
    const hudBottom=120*this.viewH/this.cssH;
    this.drawNotice(dir > 0 ? `${label}  →` : `←  ${label}`, this.viewW*.5, hudBottom, this.windWarning>0?'#efd45d':'#a9dfce',24);
    ctx.restore();
  }

          drawFloaters() {
    for(const f of this.floaters){
      if(!f.alive)continue;
      this.drawNotice(f.text,f.x,f.y-34,'#f6f3df',18);
    }
  }

          drawDanger() {
    if (this.phase !== "play") return;
    const danger = clamp((Math.abs(this.ballU) - BALL_LIMIT * 0.62) / (BALL_LIMIT * 0.38), 0, 1);
    if (danger <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(224,122,95,${0.16 * danger})`;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (danger > 0.45) {
      const labelY=Math.max(190*this.viewH/this.cssH,this.boardCenterY()-65);
      this.drawNotice('!  快稳住',this.playerX,labelY,'#f5a4c4',23);
    }
  }
}

function iLeaf(n        ) {
  return hash(n) > 0.55 ? "#55bca5" : "#c3b4dc";
}

function obstacleSpec(kind      )                           {
  if (kind === "crate") return { w: 46, h: 40 };
  if (kind === "stump") return { w: 40, h: 46 };
  if (kind === "rock") return { w: 52, h: 34 };
  return { w: 64, h: 30 };
}

function roundRect(
  ctx                          ,
  x        ,
  y        ,
  w        ,
  h        ,
  r        ,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
