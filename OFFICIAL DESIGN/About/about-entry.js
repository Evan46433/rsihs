/* about-entry.js - About page only.
   Flow: draw "RS" -> circle opens from the centre (portal, locked) -> scroll gesture ->
   portal expands, "INTRODUCING... / ROUND SQUARE" stage (held) -> scroll gesture -> page unlocks.
   A floating logo cube then stays on the side and turns with the page's sections.
   Markup is injected here, so About/index.html needs only a <link> and this <script>. */
(() => {
  "use strict";
  const SCRIPT = document.currentScript;
  const IMG = (SCRIPT && SCRIPT.dataset.images) || "../Images/";     // override with data-images="..."
    const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MATCH = { d1: 0.08, d2: 0.10, minW: 80, minH: 60, idleMs: 900, maxStrokes: 6 };  // recognizer tuning
  const root = document.documentElement;
  /* The intro plays only when the URL carries ?intro=true (the home page About links add it).
     Without it the page loads normally. Add data-always to the <script> tag to force the intro (testing). */
  const play = new URLSearchParams(location.search).get("intro") === "true" || !!(SCRIPT && SCRIPT.hasAttribute("data-always"));
  if (play) root.classList.add("rs-pending");

  // brand fonts (same families the site already loads); add only if the page doesn't have them
  if (!document.querySelector('link[href*="Plus+Jakarta"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap";
    document.head.appendChild(l);
  }

  const $ = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
  const tween = (ms, fn) => new Promise(res => {
    if (RM) { fn(1); return res(); }
    const t0 = performance.now();
    const step = n => { const t = Math.min((n - t0) / ms, 1); fn(ease(t)); t < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });

  /*REC-START*/
  /* ===== "RS" recognizer: two-way Chamfer distance against a stroke-font template =====
     Skeletons live in a unit box (y down). The user's strokes, however many, are
     normalised to their own bounding box and compared with the "R" + "S" template.
     Both directions must be close: every drawn point near the template (no scribbles)
     AND every template point near the drawing (no partial letters). */
  const R_POLYS = [[[0,1],[0,0],[.6,0],[.85,.08],[.95,.25],[.85,.42],[.6,.5],[0,.5]], [[.45,.5],[1,1]]];
  const S_POLYS = [[[.95,.15],[.8,.03],[.5,0],[.2,.05],[.05,.2],[.15,.4],[.5,.5],[.85,.6],[.95,.8],[.8,.95],[.5,1],[.2,.95],[.05,.85]]];
  function resample(poly, step) {
    const out = [poly[0]]; let carry = 0;
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1], [bx, by] = poly[i], len = Math.hypot(bx - ax, by - ay);
      let d = step - carry;
      for (; d <= len; d += step) out.push([ax + (bx - ax) * d / len, ay + (by - ay) * d / len]);
      carry = len - (d - step);
    }
    out.push(poly[poly.length - 1]); return out;
  }
  const RT = R_POLYS.flatMap(p => resample(p, .02)), ST = S_POLYS.flatMap(p => resample(p, .02));
  function meanNearest(A, B) {
    let s = 0;
    for (const a of A) { let m = 1e9; for (const b of B) { const d = (a[0]-b[0])**2 + (a[1]-b[1])**2; if (d < m) m = d; } s += Math.sqrt(m); }
    return s / A.length;
  }
  const norm = pts => {                                  // scale a point set into its own unit box
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = x1 - x0, h = y1 - y0; if (w < .12 || h < .3) return null;
    return pts.map(([x, y]) => [(x - x0) / w, (y - y0) / h]);
  };
  function recognizeRS(strokes) {
    if (!strokes.length || strokes.length > MATCH.maxStrokes) return { ok: false, why: "strokes" };
    const all = strokes.flat(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of all) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const w = x1 - x0, h = y1 - y0;
    if (w < MATCH.minW || h < MATCH.minH) return { ok: false, why: "small" };
    if (w / h < 0.9 || w / h > 3.6) return { ok: false, why: "shape" };
    const diag = Math.hypot(w, h), pts = [];
    for (const s of strokes) if (s.length > 1) resample(s.map(p => [(p.x - x0) / diag, (p.y - y0) / diag]), 1 / 70).forEach(p => pts.push([p[0] * diag / w, p[1] * diag / h]));
    // split the drawing into a left letter (R) and a right letter (S) at the middle, then score each on its own
    const L = norm(pts.filter(p => p[0] < .5)), Rr = norm(pts.filter(p => p[0] >= .5));
    if (!L || !Rr) return { ok: false, why: "short" };
    const r1 = meanNearest(L, RT), r2 = meanNearest(RT, L), s1 = meanNearest(Rr, ST), s2 = meanNearest(ST, Rr);
    return { ok: Math.max(r1, s1) < MATCH.d1 && Math.max(r2, s2) < MATCH.d2, r1, r2, s1, s2 };
  }
  /*REC-END*/

  /* ================= gate ================= */
  function mountGate() {
    const gate = $("div", "rs-gate"), ring = $("div", "rs-ring"), stage = $("div", "rs-stage");
    gate.setAttribute("role", "dialog"); gate.setAttribute("aria-modal", "true"); gate.setAttribute("aria-label", "Draw RS to enter the About page");
    const canvas = $("canvas", "rs-canvas"), hint = $("p", "rs-hint", 'Draw <b>RS</b> to enter'), skip = $("button", "rs-skip", "Skip");
    skip.type = "button"; hint.setAttribute("aria-live", "polite");
    gate.append(canvas, hint, skip);
    const split = (t, cls) => `<p class="${cls}" aria-label="${t}">` + [...t].map((c, i) => `<span class="rs-ch" style="--i:${i}" aria-hidden="true">${c === " " ? "&nbsp;" : c}</span>`).join("") + "</p>";
    stage.innerHTML = split("INTRODUCING...", "rs-kicker") + split("ROUND SQUARE", "rs-name") + '<span class="rs-more">Scroll to continue</span>';
    document.body.append(stage, gate, ring);
    root.classList.add("rs-locked"); root.classList.remove("rs-pending");
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}   // refresh = normal page

    const ctx = canvas.getContext("2d");
    let W, H, dpr, strokes = [], cur = null, drawing = false, idleT, state = "draw", raf, last = performance.now();
    const parts = [];
    const guide = () => { const w = Math.min(W * .62, H * .45 * 1.7), h = w / 1.7; return { x: (W - w) / 2, y: (H - h) / 2 - H * .04, w, h }; };
    function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    addEventListener("resize", resize); resize();

    /* hole in the gate's mask: rx/ry in px. A tall thin ellipse reads as a door slit, equal radii as a circle. */
    function setHole(rx, ry) {
      const m = `radial-gradient(ellipse ${Math.max(rx, .5)}px ${Math.max(ry, .5)}px at 50% 50%,transparent 97%,#000 100%)`;
      gate.style.webkitMaskImage = gate.style.maskImage = m;
      ring.style.width = rx * 2 + "px"; ring.style.height = ry * 2 + "px";
    }
    setHole(.5, .5);

    /* physics trail: particles inherit pointer velocity, then drag + gravity pull them down; a few become twinkling stars */
    function emit(x, y, vx, vy, n) {
      for (let i = 0; i < n; i++) {
        parts.push({ x, y, vx: vx * .12 + rnd(-35, 35), vy: vy * .12 + rnd(-35, 35) - 12, life: 1, d: rnd(.5, 1.4), r: rnd(.8, 2.2), star: Math.random() < .14 });
        if (parts.length > (RM ? 120 : 700)) parts.shift();
      }
    }
    function draw(now) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      if (state === "draw") {            // dotted guide so people know what to trace
        const g = guide(); ctx.save(); ctx.setLineDash([2, 10]); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 3;
        const polys = [...R_POLYS.map(p => p.map(([x, y]) => [x * .45, y])), ...S_POLYS.map(p => p.map(([x, y]) => [.55 + x * .45, y]))];
        for (const p of polys) { ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(g.x + x * g.w, g.y + y * g.h) : ctx.moveTo(g.x + x * g.w, g.y + y * g.h)); ctx.stroke(); }
        ctx.restore();
      }
      ctx.shadowColor = "#9cc4ff"; ctx.shadowBlur = 18; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.lineJoin = ctx.lineCap = "round";
      for (const s of strokes) { if (s.length < 2) continue; ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
      ctx.shadowBlur = 0;
      if (state === "portal" && !RM && Math.random() < .5) { const a = rnd(0, 6.283), r = Math.min(W, H) * .3; emit(W / 2 + Math.cos(a) * r * .8, H / 2 + Math.sin(a) * r, Math.cos(a) * 60, Math.sin(a) * 60, 1); }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt / p.d;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += 90 * dt; const k = Math.pow(.25, dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.fillStyle = `rgba(200,222,255,${p.life})`; ctx.strokeStyle = ctx.fillStyle;
        if (p.star) { const L = p.r * 5 * p.life; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y); ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.4 + p.life), 0, 6.283); ctx.fill(); }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    raf = requestAnimationFrame(draw);

    // --- input: Pointer Events = mouse + touch + pen. Coalesced events keep the trail smooth on fast strokes. ---
    let lx, ly, lt;
    canvas.addEventListener("pointerdown", e => {
      if (state !== "draw") return; clearTimeout(idleT);
      if (strokes.length >= MATCH.maxStrokes) strokes = [];
      drawing = true; cur = [{ x: e.clientX, y: e.clientY }]; strokes.push(cur); lx = e.clientX; ly = e.clientY; lt = performance.now();
      canvas.setPointerCapture(e.pointerId); hint.innerHTML = "Draw <b>R</b>, then <b>S</b>";
    });
    canvas.addEventListener("pointermove", e => {
      if (!drawing || state !== "draw") return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e], now = performance.now(), dt = Math.max((now - lt) / 1000, .001);
      for (const c of (evs.length ? evs : [e])) {
        const dx = c.clientX - lx, dy = c.clientY - ly, dist = Math.hypot(dx, dy);
        if (dist < 1) continue;
        const n = Math.ceil(dist / 5);                        // fill the gap between events so the trail has no holes
        for (let i = 1; i <= n; i++) emit(lx + dx * i / n, ly + dy * i / n, dx / dt, dy / dt, RM ? 1 : 2);
        cur.push({ x: c.clientX, y: c.clientY }); lx = c.clientX; ly = c.clientY;
      }
      lt = now;
    });
    const up = () => { if (!drawing) return; drawing = false; clearTimeout(idleT); idleT = setTimeout(evaluate, MATCH.idleMs); };  // wait: the S may follow the R
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);

    function evaluate() {
      if (state !== "draw") return;
      const r = recognizeRS(strokes);
      if (r.ok) return open();
      hint.textContent = r.why === "small" ? "Draw bigger — fill the dotted guide" : "Not quite. Trace the dotted R and S";
      strokes = [];
      setTimeout(() => { if (state === "draw") hint.innerHTML = "Draw <b>RS</b> to enter"; }, 1800);
    }

    /* resolves on a deliberate downward gesture: wheel, swipe up, or ArrowDown/PageDown/Space/End */
    function scrollIntent() {
      return new Promise(res => {
        let acc = 0, ty = null, done = false;
        const off = () => { removeEventListener("wheel", wh); removeEventListener("touchstart", ts); removeEventListener("touchmove", tm); removeEventListener("keydown", kd); };
        const go = () => { if (done) return; done = true; off(); res(); };
        const wh = e => { e.preventDefault(); acc = e.deltaY > 0 ? acc + e.deltaY : 0; if (acc > 40) go(); };
        const ts = e => { ty = e.touches[0].clientY; };
        const tm = e => { e.preventDefault(); if (ty != null && ty - e.touches[0].clientY > 50) go(); };
        const kd = e => { if (["ArrowDown", "PageDown", " ", "End"].includes(e.key)) { e.preventDefault(); go(); } };
        addEventListener("wheel", wh, { passive: false }); addEventListener("touchstart", ts, { passive: true });
        addEventListener("touchmove", tm, { passive: false }); addEventListener("keydown", kd);
      });
    }

    let finished = false;
    function finish() {                                      // shared exit: unlock scroll, start the cube
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      gate.remove(); ring.remove(); stage.remove();
      removeEventListener("resize", resize);
      root.classList.remove("rs-locked"); scrollTo(0, 0);
      mountCube(); dispatchEvent(new CustomEvent("aboutentry:opened"));
    }

    async function open() {
      state = "portal"; gate.classList.add("is-accepted"); hint.textContent = ""; ring.classList.add("on");
      for (let i = 0; i < 60; i++) { const a = rnd(0, 6.283); emit(W / 2 + Math.cos(a) * 80, H / 2 + Math.sin(a) * 80, Math.cos(a) * 500, Math.sin(a) * 500, 1); }
      strokes = [];
      const ry0 = Math.min(W, H) * .3;
      await tween(1300, t => setHole(t * ry0, t * ry0));             // circle opens outward from the centre
      hint.textContent = "Scroll down to step through"; hint.style.pointerEvents = "none";
      await scrollIntent();                                         // portal stays locked in place until this
      if (finished) return;
      hint.textContent = "";
      const full = Math.hypot(W, H) / 2 * 1.1;
      await tween(1400, t => { const r = ry0 + (full - ry0) * t; setHole(r, r); ring.style.opacity = 1 - t; });
      stage.classList.add("on"); await wait(500); if (finished) return;
      stage.classList.add("in-1"); await wait(1100); if (finished) return;
      stage.classList.add("in-2"); await wait(1500); if (finished) return;
      stage.classList.add("ready");                                 // held until the next scroll
      await scrollIntent(); if (finished) return;
      stage.classList.add("out"); await wait(900);
      finish();
    }
    skip.addEventListener("click", finish);
    addEventListener("keydown", e => { if (e.key === "Escape") finish(); });
    skip.focus({ preventScroll: true });
  }

  /* ================= side cube ================= */
  function mountCube() {
    if (document.querySelector(".rs-cube-wrap")) return;
    const wrap = $("div", "rs-cube-wrap"), cube = $("div", "rs-cube");
    wrap.setAttribute("role", "img"); wrap.setAttribute("aria-label", "Cube showing The Indian High School Dubai and Round Square logos"); wrap.tabIndex = 0;
    const logos = ["ihslogo.png", "roundsquarelogo.jpeg", "ihslogo.png", "roundsquarelogo.jpeg", "roundsquarelogo.jpeg", "ihslogo.png"];
    logos.forEach((f, i) => { const face = $("div", "rs-face rs-f" + i), im = new Image(); im.src = IMG + f; im.alt = ""; im.decoding = "async"; face.appendChild(im); cube.appendChild(face); });
    wrap.appendChild(cube); document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("on"));

    // Each content section = one quarter turn. We read the scroll position as a fractional section index
    // so the cube rotates continuously and lands face-on as a section fills the viewport.
    const secs = () => [...document.querySelectorAll("main section")];
    function sectionPos() {
      const s = secs(), y = scrollY + innerHeight / 2;
      if (!s.length) return scrollY / innerHeight;
      let i = 0; for (let k = 0; k < s.length; k++) if (s[k].getBoundingClientRect().top + scrollY <= y) i = k;
      const r = s[i].getBoundingClientRect(); return i + Math.min(Math.max((y - (r.top + scrollY)) / r.height, 0), 1);
    }
    let rotY = 0, rotX = -14, drag = 0, dragging = false, px = 0, moved = 0; const t0 = performance.now();
    wrap.addEventListener("pointerdown", e => { dragging = true; moved = 0; px = e.clientX; wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener("pointermove", e => { if (!dragging) return; drag += (e.clientX - px) * .6; moved += Math.abs(e.clientX - px); px = e.clientX; });
    wrap.addEventListener("pointerup", () => { dragging = false; if (moved < 4) drag += 90; });   // tap = flip a quarter turn
    wrap.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drag += 90; } });
    (function tick(now) {
      requestAnimationFrame(tick);
      if (!dragging) drag *= RM ? .8 : .985;                         // user spin eases back toward the section-aligned pose
      const target = sectionPos() * 90 + (RM ? 0 : (now - t0) * .004) + drag;
      rotY += (target - rotY) * (RM ? 1 : .09);
      const prog = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
      rotX = -14 + Math.sin(prog * Math.PI * 2) * 12;
      cube.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${(-rotY).toFixed(2)}deg)`;
    })(performance.now());
  }

  function init() {
    try { play ? mountGate() : mountCube(); }
    catch (err) { console.error("about-entry failed:", err); root.classList.remove("rs-pending", "rs-locked"); }   // never leave the page hidden
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
