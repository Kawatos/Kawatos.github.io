(() => {
  "use strict";

  const CFG = window.SITE_CONFIG;
  const I18N = window.I18N;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) {
    root.classList.add("has-gsap");
    gsap.registerPlugin(ScrollTrigger);
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* =========================================================
     i18n
     ========================================================= */
  const LANGS = ["pt", "es", "en", "ja"];
  const HTML_LANG = { pt: "pt-BR", es: "es", en: "en", ja: "ja" };
  const LANG_NAME = { pt: "Português", es: "Español", en: "English", ja: "日本語" };

  function detectLang() {
    const saved = store.get("lang");
    if (LANGS.includes(saved)) return saved;
    for (const l of navigator.languages || [navigator.language || ""]) {
      const p = l.slice(0, 2).toLowerCase();
      if (LANGS.includes(p)) return p;
    }
    return "pt";
  }

  let lang = detectLang();
  const t = (key, vars) => {
    let s = (I18N[lang] && I18N[lang][key]) ?? I18N.pt[key] ?? key;
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  };

  function applyLang() {
    root.lang = HTML_LANG[lang];
    document.title = t("meta.title");
    $('meta[name="description"]').setAttribute("content", t("meta.desc"));

    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $(".ring-text").textContent = t("contact.ring");

    $$(".langs button").forEach(b => {
      const on = b.dataset.lang === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on);
    });

    $$("[data-words]").forEach(splitWords);
    rotator.reset();
    chat.refreshPlaceholder();
    if (hasGsap) requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  function setLang(next) {
    if (next === lang || !LANGS.includes(next)) return;
    lang = next;
    store.set("lang", lang);

    if (!hasGsap || reduced) return applyLang();

    // cortina vermelha com o nome do idioma
    const wipe = document.createElement("div");
    wipe.className = "wipe";
    wipe.innerHTML = `<span lang="${HTML_LANG[lang]}">${LANG_NAME[lang]}</span>`;
    document.body.appendChild(wipe);
    const label = wipe.firstChild;
    gsap.timeline({ onComplete: () => wipe.remove() })
      .fromTo(wipe, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: .55, ease: "power4.inOut" })
      .fromTo(label, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .45, ease: "power3.out" }, "-=.2")
      .add(applyLang)
      .to(label, { yPercent: -60, opacity: 0, duration: .35, ease: "power2.in" }, "+=.15")
      .to(wipe, { clipPath: "inset(0 0 100% 0)", duration: .6, ease: "power4.inOut" }, "-=.15");
  }

  $$(".langs button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

  /* =========================================================
     Texto: split em palavras (statement) e letras (hero)
     ========================================================= */
  function splitWords(el) {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    const parts = lang === "ja" ? Array.from(text) : text.split(/(\s+)/);
    el.innerHTML = parts
      .map(p => (/^\s+$/.test(p) ? p : `<span class="w" aria-hidden="true">${p}</span>`))
      .join("");
    el._words = $$(".w", el);
    paintWords(el, el._progress || 0);
  }

  function paintWords(el, progress) {
    el._progress = progress;
    const words = el._words || [];
    const lit = Math.round(progress * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < lit));
  }

  $$("[data-split]").forEach(el => {
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = Array.from(el.textContent).map(c => `<span class="ch">${c}</span>`).join("");
  });

  /* =========================================================
     Rotator do hero
     ========================================================= */
  const rotator = (() => {
    const box = $(".rotator");
    const word = $(".rotator__word");
    let i = 0, timer = null;

    function show(next) {
      if (!hasGsap || reduced) { word.textContent = next; return; }
      gsap.timeline()
        .to(word, { yPercent: -110, duration: .45, ease: "power3.in" })
        .add(() => { word.textContent = next; })
        .fromTo(word, { yPercent: 110 }, { yPercent: 0, duration: .6, ease: "power3.out" });
    }

    return {
      reset() {
        clearInterval(timer);
        const words = t("hero.words");
        i = 0;
        word.textContent = words[0];
        box.setAttribute("aria-label", words.join(", "));
        timer = setInterval(() => { i = (i + 1) % words.length; show(words[i]); }, 2400);
      }
    };
  })();

  /* =========================================================
     Chat → e-mail
     ========================================================= */
  const chat = (() => {
    const fab = $(".chat-fab");
    const box = $("#chat");
    const log = $(".chat__log");
    const form = $(".chat__form");
    const input = $(".chat__input");
    const send = $(".chat__send");
    const honey = $(".hp", form);

    const data = { topic: "", name: "", email: "", message: "" };
    let step = "idle";
    let started = false;
    let queue = Promise.resolve();

    const PH = { topic: "chat.ph.topic", name: "chat.ph.name", email: "chat.ph.email", message: "chat.ph.msg" };

    function refreshPlaceholder() {
      input.placeholder = t(PH[step] || "chat.ph.topic");
    }

    function setStep(s) {
      step = s;
      const busy = s === "sending" || s === "done";
      input.disabled = busy;
      send.disabled = busy;
      input.inputMode = s === "email" ? "email" : "text";
      input.autocomplete = s === "email" ? "email" : s === "name" ? "name" : "off";
      refreshPlaceholder();
      if (!busy && !box.hidden && finePointer) input.focus();
    }

    function scrollDown() { log.scrollTop = log.scrollHeight; }

    function bubble(content, who = "them", isHTML = false) {
      const b = document.createElement("div");
      b.className = `msg msg--${who}`;
      if (isHTML) b.innerHTML = content; else b.textContent = content;
      log.appendChild(b);
      scrollDown();
      return b;
    }

    function say(content, isHTML = false) {
      queue = queue.then(() => new Promise(res => {
        const typing = document.createElement("div");
        typing.className = "msg msg--them msg--typing";
        typing.innerHTML = "<i></i><i></i><i></i>";
        log.appendChild(typing);
        scrollDown();
        const plain = isHTML ? content.replace(/<[^>]+>/g, "") : content;
        const delay = reduced ? 0 : Math.min(1300, 450 + plain.length * 14);
        setTimeout(() => { typing.remove(); bubble(content, "them", isHTML); res(); }, delay);
      }));
      return queue;
    }

    function quickReplies() {
      queue = queue.then(() => {
        const wrap = document.createElement("div");
        wrap.className = "quick";
        ["chat.t1", "chat.t2", "chat.t3", "chat.t4"].forEach(k => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = t(k);
          b.addEventListener("click", () => handle(t(k)));
          wrap.appendChild(b);
        });
        log.appendChild(wrap);
        scrollDown();
      });
      return queue;
    }

    async function start() {
      started = true;
      setStep("topic");
      say(t("chat.hi"));
      say(t("chat.intro"));
      quickReplies();
    }

    async function handle(text) {
      text = text.trim();
      if (!text || step === "sending" || step === "done") return;
      $$(".quick", log).forEach(q => q.classList.add("quick--done"));
      bubble(text, "me");
      input.value = "";
      autosize();

      switch (step) {
        case "topic":
          data.topic = text;
          if (data.name && data.email) { setStep("message"); say(t("chat.askMsg")); }
          else { setStep("name"); say(t("chat.askName")); }
          break;
        case "name":
          data.name = text.slice(0, 80);
          setStep("email");
          say(t("chat.askEmail", { name: data.name.split(" ")[0] }));
          break;
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) { say(t("chat.badEmail")); break; }
          data.email = text;
          setStep("message");
          say(t("chat.askMsg"));
          break;
        case "message":
          data.message = text;
          setStep("sending");
          await queue;
          deliver();
          break;
      }
    }

    async function deliver() {
      const pending = bubble(t("chat.sending"), "them");
      pending.classList.add("msg--pending");
      let ok = false;

      if (honey.value) ok = true; // bot: finge sucesso e não envia
      else {
        try {
          const res = await fetch(CFG.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              name: data.name,
              email: data.email,
              assunto: data.topic,
              message: data.message,
              idioma: LANG_NAME[lang],
              _replyto: data.email,
              _subject: `[Portfólio] ${data.topic} — ${data.name}`,
              _template: "box",
              _captcha: "false"
            })
          });
          const json = await res.json().catch(() => ({}));
          ok = res.ok && String(json.success) === "true";
        } catch (e) { ok = false; }
      }

      pending.remove();
      if (ok) {
        await say(t("chat.ok", { email: data.email }));
      } else {
        const subject = encodeURIComponent(`[Portfólio] ${data.topic} — ${data.name}`);
        const body = encodeURIComponent(`${data.message}\n\n— ${data.name} (${data.email})`);
        const wa = encodeURIComponent(`Oi Kauã! ${data.message}`);
        await say(
          `${t("chat.err")}<span class="msg__links">` +
          `<a href="mailto:${CFG.email}?subject=${subject}&body=${body}">${CFG.email}</a>` +
          `<a href="https://wa.me/${CFG.whatsapp}?text=${wa}" target="_blank" rel="noopener">WhatsApp ${CFG.phoneDisplay}</a></span>`,
          true
        );
      }
      setStep("done");
      queue = queue.then(() => {
        const wrap = document.createElement("div");
        wrap.className = "quick";
        const again = document.createElement("button");
        again.type = "button";
        again.textContent = t("chat.again");
        again.addEventListener("click", () => {
          wrap.classList.add("quick--done");
          data.topic = data.message = "";
          setStep("topic");
          say(t("chat.intro"));
          quickReplies();
        });
        wrap.appendChild(again);
        log.appendChild(wrap);
        scrollDown();
      });
    }

    function autosize() {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
      input.style.overflowY = input.scrollHeight > 140 ? "auto" : "hidden";
    }

    function open() {
      box.hidden = false;
      box.classList.remove("is-closing");
      fab.setAttribute("aria-expanded", "true");
      if (!started) start();
      else if (finePointer) input.focus();
    }

    function close() {
      if (box.hidden) return;
      box.classList.add("is-closing");
      fab.setAttribute("aria-expanded", "false");
      setTimeout(() => { box.hidden = true; box.classList.remove("is-closing"); }, reduced ? 0 : 340);
      fab.focus({ preventScroll: true });
    }

    fab.addEventListener("click", open);
    $(".chat__close").addEventListener("click", close);
    $$("[data-open-chat]").forEach(b => b.addEventListener("click", open));
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    form.addEventListener("submit", e => { e.preventDefault(); handle(input.value); });
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); handle(input.value); }
    });
    // impede a rolagem suave da página de "roubar" o scroll do chat
    box.setAttribute("data-lenis-prevent", "");

    return { refreshPlaceholder };
  })();

  /* =========================================================
     Aplica idioma inicial
     ========================================================= */
  applyLang();

  /* =========================================================
     Tema
     ========================================================= */
  const themeColor = $('meta[name="theme-color"]');
  function syncThemeColor() { themeColor.setAttribute("content", root.dataset.theme === "light" ? "#ece6da" : "#0c0c0a"); }
  syncThemeColor();
  $(".theme-toggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    store.set("theme", root.dataset.theme);
    syncThemeColor();
  });

  /* =========================================================
     Relógio local
     ========================================================= */
  const clock = $(".clock");
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: CFG.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 1000);
  $(".year").textContent = new Date().getFullYear();

  /* =========================================================
     Experiência (acordeão)
     ========================================================= */
  $$(".job").forEach((job, i) => {
    const head = $(".job__head", job);
    const toggle = force => {
      const open = force ?? !job.classList.contains("is-open");
      job.classList.toggle("is-open", open);
      head.setAttribute("aria-expanded", open);
    };
    head.addEventListener("click", () => { toggle(); if (hasGsap) setTimeout(() => ScrollTrigger.refresh(), 650); });
    if (i === 0) toggle(true);
  });

  /* =========================================================
     Copiar e-mail
     ========================================================= */
  const copyBtn = $(".copy-email");
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(CFG.email); }
    catch (e) { location.href = `mailto:${CFG.email}`; return; }
    const hint = $(".channels__hint", copyBtn);
    copyBtn.classList.add("is-copied");
    hint.textContent = t("contact.copied");
    setTimeout(() => { copyBtn.classList.remove("is-copied"); hint.textContent = t("contact.copy"); }, 1800);
  });

  /* =========================================================
     GitHub: contagem de repositórios ao vivo
     ========================================================= */
  (async () => {
    let n = null;
    try { n = JSON.parse(sessionStorage.getItem("gh")); } catch (e) {}
    if (!n) {
      try {
        const r = await fetch(`https://api.github.com/users/${CFG.githubUser}`);
        if (r.ok) n = (await r.json()).public_repos;
        try { sessionStorage.setItem("gh", JSON.stringify(n)); } catch (e) {}
      } catch (e) {}
    }
    if (typeof n === "number" && n > 0) {
      $$(".repo-count").forEach(el => {
        if (el.dataset.count) { el.dataset.count = n; if (el.dataset.done) el.textContent = n; }
        else el.textContent = n;
      });
    }
  })();

  /* =========================================================
     Menu mobile
     ========================================================= */
  const burger = $(".burger");
  const mmenu = $("#mobile-menu");
  let lenis = null;
  function setMenu(open) {
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", t(open ? "nav.close" : "nav.menu"));
    burger.classList.toggle("is-open", open);
    if (open) { mmenu.hidden = false; requestAnimationFrame(() => mmenu.classList.add("is-open")); lenis && lenis.stop(); }
    else { mmenu.classList.remove("is-open"); setTimeout(() => { if (!mmenu.classList.contains("is-open")) mmenu.hidden = true; }, 700); lenis && lenis.start(); }
    document.body.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  $$("a", mmenu).forEach(a => a.addEventListener("click", () => setMenu(false)));

  /* =========================================================
     Reveal + contadores (IntersectionObserver)
     ========================================================= */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains("reveal"));
      el.style.setProperty("--d", `${Math.max(0, sibs.indexOf(el)) * 0.08}s`);
      el.classList.add("is-in");
      $$("[data-count]", el).forEach(countUp);
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach(el => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count;
    if (reduced) { el.textContent = end; el.dataset.done = 1; return; }
    const t0 = performance.now(), dur = 1400;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(+el.dataset.count * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step); else el.dataset.done = 1;
    };
    requestAnimationFrame(step);
  }

  /* =========================================================
     Cursor + magnetismo
     ========================================================= */
  if (finePointer && !reduced) {
    const cur = $(".cursor");
    const label = $(".cursor__label");
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; }, { passive: true });
    addEventListener("pointerdown", () => cur.classList.add("is-down"));
    addEventListener("pointerup", () => cur.classList.remove("is-down"));
    (function loop() {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener("pointerover", e => {
      const target = e.target.closest("[data-cursor], a, button, textarea, input");
      cur.classList.remove("is-hover", "is-label", "is-text");
      if (!target) return;
      if (target.matches("textarea, input")) return cur.classList.add("is-text");
      if (target.dataset.cursor) { label.textContent = target.dataset.cursor; cur.classList.add("is-label"); }
      else cur.classList.add("is-hover");
    });
    document.addEventListener("pointerleave", () => { cur.style.opacity = 0; });
    document.addEventListener("pointerenter", () => { cur.style.opacity = 1; });

    $$("[data-magnetic]").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
        el.style.transform = "";
        setTimeout(() => { el.style.transition = ""; }, 600);
      });
    });

    // Letras do nome reagem à proximidade do mouse (eixo de largura da fonte variável)
    const chars = $$(".hero__name .ch");
    const hero = $(".hero");
    let near = false, raf = null;
    hero.addEventListener("pointermove", () => { near = true; if (!raf) raf = requestAnimationFrame(flex); });
    hero.addEventListener("pointerleave", () => { near = false; if (!raf) raf = requestAnimationFrame(flex); });
    function flex() {
      raf = null;
      chars.forEach(c => {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        const k = near ? Math.max(0, 1 - d / 380) : 0;
        const e = k * k * (3 - 2 * k);
        c.style.fontVariationSettings = `"wdth" ${72 + e * 53}, "wght" ${800 + e * 100}`;
        c.style.color = e > 0.55 ? "var(--red)" : "";
      });
      if (near) raf = requestAnimationFrame(flex);
    }
  }

  /* =========================================================
     Sem GSAP: libera tudo e encerra aqui
     ========================================================= */
  const loader = $(".loader");
  const fab = $(".chat-fab");
  if (!hasGsap || reduced) {
    loader.remove();
    $$(".title__in").forEach(el => (el.style.transform = "none"));
    initNavScroll();
    return;
  }

  /* =========================================================
     Rolagem suave (Lenis) integrada ao ScrollTrigger
     ========================================================= */
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      const el = id === "#top" ? 0 : $(id);
      if (el === null) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    }));
  }

  initNavScroll();

  /* =========================================================
     Intro
     ========================================================= */
  lenis && lenis.stop();
  fab.classList.add("is-pre");
  const num = $(".loader__num");
  const counter = { v: 0 };
  const firstVisit = !sessionStorage.getItem("seen");
  try { sessionStorage.setItem("seen", 1); } catch (e) {}

  const intro = gsap.timeline({
    defaults: { ease: "power4.out" },
    onComplete: () => { loader.remove(); lenis && lenis.start(); }
  });
  intro
    .to(".loader__stamp", { opacity: 1, scale: 1, rotate: -8, duration: .5, ease: "back.out(2.2)" }, .1)
    .to(counter, {
      v: 100, duration: firstVisit ? 1.3 : .6, ease: "power2.inOut",
      onUpdate: () => { num.textContent = String(Math.round(counter.v)).padStart(3, "0"); }
    }, 0)
    .to(".loader__stamp", { scale: .9, duration: .12, ease: "power1.in" })
    .to(loader, { clipPath: "inset(0 0 100% 0)", duration: .9, ease: "power4.inOut" }, "+=.05")
    .from(".hero__name .ch", { yPercent: 110, duration: 1.1, stagger: .045 }, "-=.45")
    .from(".hero__jp, .hero__vertical", { opacity: 0, y: 20, duration: .8 }, "-=.7")
    .from(".hero__meta > *", { opacity: 0, y: -14, duration: .7, stagger: .08 }, "-=.8")
    .from(".hero__bottom", { opacity: 0, y: 30, duration: .9 }, "-=.7")
    .from(".nav > *", { y: -60, opacity: 0, duration: .8, stagger: .08, clearProps: "transform,opacity" }, "-=.9")
    .add(() => fab.classList.remove("is-pre"), "-=.4");
  $$(".hero .reveal").forEach(el => el.classList.add("is-in"));

  /* =========================================================
     Scroll: progresso, hero, marquee, títulos, palavras
     ========================================================= */
  gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .3 } });

  gsap.to(".hero__name", {
    yPercent: -18, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero__vertical", {
    y: -160, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  // marquee: velocidade e direção seguem a rolagem
  const track = $(".marquee__track");
  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    trigger: ".marquee", start: "top bottom", end: "bottom top",
    onUpdate(self) {
      const v = self.getVelocity();
      if (v !== 0) dir = v > 0 ? 1 : -1;
      gsap.to(loop, { timeScale: dir * (1 + Math.min(Math.abs(v) / 250, 6)), duration: .2, overwrite: true });
      gsap.to(track, { skewX: gsap.utils.clamp(-8, 8, -v / 300), duration: .3, overwrite: "auto" });
    },
    onLeave: () => gsap.to(track, { skewX: 0 }),
  });
  ScrollTrigger.addEventListener("scrollEnd", () => {
    gsap.to(loop, { timeScale: dir, duration: .8 });
    gsap.to(track, { skewX: 0, duration: .6 });
  });

  $$(".title__in").forEach(el => {
    gsap.from(el, {
      yPercent: 105, rotate: 2, duration: 1.2, ease: "power4.out",
      scrollTrigger: { trigger: el.parentElement, start: "top 88%" }
    });
  });

  $$("[data-words]").forEach(el => {
    ScrollTrigger.create({
      trigger: el, start: "top 82%", end: "bottom 45%", scrub: true,
      onUpdate: self => paintWords(el, self.progress)
    });
  });

  gsap.from(".idcard", {
    rotate: -6, y: 80, opacity: 0, duration: 1.3, ease: "power4.out",
    scrollTrigger: { trigger: ".idcard", start: "top 85%" }
  });

  gsap.from(".job", {
    opacity: 0, y: 40, duration: .9, stagger: .07, ease: "power3.out",
    scrollTrigger: { trigger: ".jobs", start: "top 85%" }
  });

  gsap.from(".footer__big span", {
    yPercent: 60, opacity: 0, duration: 1.4, ease: "power4.out", stagger: .1,
    scrollTrigger: { trigger: ".footer", start: "top 90%" }
  });

  /* =========================================================
     Projetos: trilho horizontal fixado (desktop)
     ========================================================= */
  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px)", () => {
    const pin = $(".projects__pin");
    const rail = $(".projects__track");
    const dist = () => rail.scrollWidth - innerWidth;

    const tween = gsap.to(rail, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: ".projects", start: "top top", end: () => "+=" + dist(),
        pin, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1
      }
    });

    $$(".pcard").forEach(card => {
      const k = $(".pcard__kanji", card);
      if (k) {
        gsap.fromTo(k, { xPercent: 30 }, {
          xPercent: -30, ease: "none",
          scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true }
        });
      }
      if (card.offsetLeft > innerWidth) {
        gsap.from(card, {
          rotate: 4, y: 60, opacity: 0, duration: .9, ease: "power3.out",
          scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 95%" }
        });
      }
    });
  });

  /* =========================================================
     Nav: esconde ao descer, mostra ao subir, marca seção ativa
     ========================================================= */
  function initNavScroll() {
    const nav = $(".nav");
    let last = 0;
    const onScroll = () => {
      const y = scrollY;
      nav.classList.toggle("is-scrolled", y > 40);
      nav.classList.toggle("is-hidden", y > last && y > 400 && !document.body.style.overflow);
      last = y;
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const links = $$(".nav__links a");
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["about", "work", "projects", "contact"].forEach(id => spy.observe(document.getElementById(id)));
  }

  // fontes carregadas mudam as medidas
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
