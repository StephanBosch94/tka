(function () {
  "use strict";

  const header = document.getElementById("header");
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  function onScroll() {
    if (window.scrollY > 8) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const dropdowns = [
    ...document.querySelectorAll(".nav-has-dropdown"),
    ...document.querySelectorAll(".lang-switch"),
  ];

  function closeDropdowns(except) {
    dropdowns.forEach((dropdown) => {
      if (dropdown === except) return;
      dropdown.classList.remove("is-open");
      const trigger = dropdown.querySelector("[aria-expanded]");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector(".nav-dropdown-trigger, .lang-switch__trigger");
    if (!trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("is-open");
      closeDropdowns();
      dropdown.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (willOpen && mobileNav && !mobileNav.hidden) {
        setMobileNavOpen(false);
      }
    });

    if (dropdown.classList.contains("nav-has-dropdown")) {
      dropdown.addEventListener("mouseenter", () => {
        if (window.matchMedia("(max-width: 1100px)").matches) return;
        closeDropdowns(dropdown);
        dropdown.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      });
      dropdown.addEventListener("mouseleave", () => {
        if (window.matchMedia("(max-width: 1100px)").matches) return;
        dropdown.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      });
    }
  });

  document.addEventListener("click", () => closeDropdowns());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdowns();
  });

  function setMobileNavOpen(isOpen) {
    navToggle.setAttribute("aria-expanded", String(isOpen));
    mobileNav.hidden = !isOpen;
    document.documentElement.classList.toggle("nav-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
    header.classList.toggle("is-nav-open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen) closeDropdowns();
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      setMobileNavOpen(!open);
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        setMobileNavOpen(false);
      });
    });
  }

  // Hero carousel
  const copySlides = document.querySelectorAll(".hero-copy-slide");
  const dots = document.querySelectorAll(".hero-dots button");
  const prevBtn = document.querySelector('.hero-ctrl-btn[data-dir="prev"]');
  const nextBtn = document.querySelector('.hero-ctrl-btn[data-dir="next"]');
  let currentSlide = 0;
  let autoplayTimer;

  function goToSlide(index) {
    const total = copySlides.length;
    if (!total) return;
    currentSlide = ((index % total) + total) % total;

    copySlides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === currentSlide);
    });

    dots.forEach((dot, i) => {
      dot.setAttribute("aria-selected", String(i === currentSlide));
    });
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    if (copySlides.length > 1) {
      autoplayTimer = setInterval(nextSlide, 6000);
    }
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goToSlide(Number(dot.dataset.goto));
      startAutoplay();
    });
  });

  if (prevBtn) prevBtn.addEventListener("click", () => { prevSlide(); startAutoplay(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { nextSlide(); startAutoplay(); });

  const hero = document.querySelector(".hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".hero-video, .about-video").forEach((video) => {
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const tryPlay = () => {
      const pending = video.play();
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    };

    const reveal = () => video.classList.add("is-playing");
    if (!video.paused && video.readyState >= 2) reveal();
    video.addEventListener("playing", reveal);

    tryPlay();
    video.addEventListener("loadeddata", tryPlay);

    const unlock = () => {
      tryPlay();
      if (!video.paused) window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
  });

  if (hero && copySlides.length) {
    hero.addEventListener("mouseenter", stopAutoplay);
    hero.addEventListener("mouseleave", startAutoplay);
    startAutoplay();
  }

  // Hero entrance
  if (hero) {
    requestAnimationFrame(() => {
      hero.classList.add("is-ready");
    });
  }

  // Count-up numbers
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function parseCountTarget(text) {
    const original = text.trim();
    const rangeMatch = original.match(/^(\d+)\s*[–-]\s*(\d+)$/);
    const plusMatch = original.match(/^([\d.,]+)\+$/);
    const paddedMatch = original.match(/^(0+)(\d+)$/);
    const groupedMatch = original.match(/^(\d{1,3}([.,]\d{3})+)$/);
    const plainMatch = original.match(/^(\d+)$/);

    if (plusMatch) {
      const to = Number(plusMatch[1].replace(/[.,]/g, ""));
      return {
        original,
        from: 0,
        to,
        format: (n) => `${Math.round(n)}+`,
        startLabel: "0+",
      };
    }
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      const sep = original.includes("–") ? "–" : "-";
      return {
        original,
        from,
        to,
        format: (n) => `${from}${sep}${Math.round(n)}`,
        startLabel: `${from}${sep}${from}`,
      };
    }
    if (paddedMatch) {
      const width = original.length;
      const to = Number(paddedMatch[2]);
      const format = (n) => String(Math.round(n)).padStart(width, "0");
      return {
        original,
        from: 0,
        to,
        format,
        startLabel: format(0),
      };
    }
    if (groupedMatch) {
      const sep = original.includes(".") ? "." : ",";
      const to = Number(original.replace(/[.,]/g, ""));
      const format = (n) =>
        Math.round(n)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      return {
        original,
        from: 0,
        to,
        format,
        startLabel: "0",
      };
    }
    if (plainMatch) {
      return {
        original,
        from: 0,
        to: Number(plainMatch[1]),
        format: (n) => String(Math.round(n)),
        startLabel: "0",
      };
    }
    return null;
  }

  function animateCount(el, duration) {
    if (el.dataset.counted === "true") return;
    el.dataset.counted = "true";

    const target = parseCountTarget(el.dataset.countOriginal || el.textContent);
    if (!target) return;

    if (reduceMotion) {
      el.textContent = target.original;
      return;
    }

    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const value = target.from + (target.to - target.from) * easeOutCubic(t);
      el.textContent = target.format(value);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target.original;
      }
    }

    el.textContent = target.startLabel;
    requestAnimationFrame(frame);
  }

  function observeCountUps(selector, duration) {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;

    if (reduceMotion) {
      els.forEach((el) => {
        el.dataset.counted = "true";
      });
      return;
    }

    els.forEach((el) => {
      const target = parseCountTarget(el.textContent);
      if (!target) return;
      el.dataset.countOriginal = target.original;
      el.textContent = target.startLabel;
    });

    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => animateCount(el, duration));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target, duration);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );

    els.forEach((el) => observer.observe(el));
  }

  observeCountUps(".metric-value, .about-stat strong, .service-num, .count-up", 1500);

  // Scroll reveal
  const revealEls = document.querySelectorAll(".reveal");

  if (reduceMotion) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else if (revealEls.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }
})();
