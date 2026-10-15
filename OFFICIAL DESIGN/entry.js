/* entry.js - "Draw to Unlock" gate, door portal, title reveal, floating logo cube.
   Self-contained: no dependencies, does not touch script.js / scroll-animation.js.
   Dispatches `entry:opened` on window when the site is revealed, so existing
   scroll-reveal code can start from that moment if you want it to. */
(() => {
  "use strict";
  const KEY = "rs-unlocked";
  const gate = document.getElementById("entry-gate");
  const body = document.body;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
  const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } },
    set: () => { try { sessionStorage.setItem(KEY, "1"); } catch (e) {} }
  };

  /* ---------- floating side cube: slow spin + scroll-linked rotation ---------- */
  const cube = document.querySelector(".side-cube .cube");
  let spinRaf;
  function startCube() {
    body.classList.add("cube-on");
    if (!cube || RM) { cube && cube.style.setProperty("--ry", "-20deg"); return; }
    const t0 = performance.now();
    const tick = now => {
      // 14deg/s idle spin + the page scroll turns it as well
      cube.style.setProperty("--ry", ((now - t0) * 0.014 + scrollY * 0.12).toFixed(2) + "deg");
      spinRaf = requestAnimationFrame(tick);
    };
    spinRaf = requestAnimationFrame(tick);
  }

  function finish(immediate) {
    body.classList.remove("gate-locked");
    store.set();
    if (!immediate) body.classList.add("portal-in");
    startCube();
    window.dispatchEvent(new CustomEvent("entry:opened"));
    if (gate) gate.remove();
  }

  // Returning visitor (the <head> script already hid the gate)
  if (!gate || store.get()) { if (gate) gate.remove(); finish(true); return; }

  const canvas = document.getElementById("entry-canvas");
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("entry-hint");
  let W, H, dpr, pts = [], drawing = false, accepted = false, raf;
  const glimmers = [];                     // sparkle particles
  const ringR = () => Math.min(W, H) * 0.24;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize); resize();

  /* Glimmers: tiny additive sparks emitted along the finger/mouse path and
     occasionally around the guide ring so the gate feels alive while idle. */
  function spark(x, y, burst) {
    const a = Math.random() * 6.283, s = burst ? 40 + Math.random() * 90 : 8 + Math.random() * 30;
    glimmers.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 1, d: 0.6 + Math.random() * 1.1, r: 0.8 + Math.random() * 1.8 });
    if (glimmers.length > 260) glimmers.shift();
  }

  let last = performance.now(), arc = 0, flash = 0;
  function render(now) {
    raf = requestAnimationFrame(render);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = ringR();

    // idle sparks orbit the ring
    if (!accepted && !RM && Math.random() < 0.25) { const a = Math.random() * 6.283; spark(cx + Math.cos(a) * R, cy + Math.sin(a) * R, false); }

    // guide ring (breathing glow)
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#9cc4ff"; ctx.shadowBlur = 22 + flash * 50 + Math.sin(now / 600) * 6;
    ctx.strokeStyle = `rgba(255,255,255,${0.28 + flash * 0.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();

    // player's stroke
    if (pts.length > 1 && !accepted) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.shadowBlur = 16;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    // accepted: perfect ring draws itself over the stroke
    if (accepted && arc > 0) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.shadowBlur = 36;
      ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * arc); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // glimmer particles
    for (let i = glimmers.length - 1; i >= 0; i--) {
      const g = glimmers[i]; g.life -= dt / g.d;
      if (g.life <= 0) { glimmers.splice(i, 1); continue; }
      g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.98; g.vy *= 0.98;
      ctx.fillStyle = `rgba(190,215,255,${g.life})`;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (0.4 + g.life), 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  raf = requestAnimationFrame(render);

  /* Gesture test: >= ~300deg of sweep around the centroid, roughly constant
     radius, and the stroke ends near where it began. */
  function isCircle(p) {
    if (p.length < 20) return false;
    let cx = 0, cy = 0; p.forEach(q => { cx += q.x; cy += q.y; }); cx /= p.length; cy /= p.length;
    const rs = p.map(q => Math.hypot(q.x - cx, q.y - cy)), mr = rs.reduce((a, b) => a + b) / rs.length;
    if (mr < 40) return false;
    const sd = Math.sqrt(rs.reduce((a, r) => a + (r - mr) ** 2, 0) / rs.length);
    let sweep = 0, prev = Math.atan2(p[0].y - cy, p[0].x - cx);
    for (const q of p) {
      const a = Math.atan2(q.y - cy, q.x - cx); let d = a - prev;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      sweep += d; prev = a;
    }
    const gap = Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y);
    return sd / mr < 0.28 && Math.abs(sweep) > Math.PI * 1.7 && gap < mr * 0.9;
  }

  // Pointer Events cover mouse, touch and pen with one code path
  canvas.addEventListener("pointerdown", e => {
    if (accepted) return;
    drawing = true; pts = [{ x: e.clientX, y: e.clientY }]; canvas.setPointerCapture(e.pointerId);
    hint.textContent = "";
  });
  canvas.addEventListener("pointermove", e => {
    if (accepted) return;
    if (drawing) pts.push({ x: e.clientX, y: e.clientY });
    if (drawing || e.pointerType === "mouse") spark(e.clientX, e.clientY, false);
  });
  const end = () => {
    if (!drawing) return; drawing = false;
    if (isCircle(pts)) return unlock();
    hint.textContent = "Close the circle and try again"; pts = [];
    setTimeout(() => { if (!accepted) hint.textContent = "Draw a circle to unlock"; }, 1400);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  /* ---------- sequence: ring completes -> title reveal -> doors open -> site ---------- */
  function animate(from, to, ms, fn) {
    return new Promise(res => {
      if (RM) { fn(to); return res(); }
      const t0 = performance.now();
      const step = now => { const t = Math.min((now - t0) / ms, 1); fn(from + (to - from) * (t * t * (3 - 2 * t))); t < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    });
  }
  async function unlock() {
    if (accepted) return; accepted = true; pts = [];
    gate.classList.add("is-accepted");
    await animate(0, 1, 900, v => (arc = v));
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283; spark(W / 2 + Math.cos(a) * ringR(), H / 2 + Math.sin(a) * ringR(), true); }
    await animate(0, 1, 350, v => (flash = v));
    gate.classList.add("is-title");   await wait(2100);   // type rises out of its masks
    gate.classList.add("is-opening"); await wait(1500);   // doors swing open, site pushes forward
    finish(false);
    cancelAnimationFrame(raf);
  }

  // Accessible alternatives: skip button and Enter/Space on the canvas
  document.getElementById("entry-skip").addEventListener("click", () => { accepted = true; cancelAnimationFrame(raf); finish(true); });
  addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("entry-gate")) { accepted = true; cancelAnimationFrame(raf); finish(true); } });
  document.getElementById("entry-skip").focus({ preventScroll: true });
})();
