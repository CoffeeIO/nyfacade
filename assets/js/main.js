(function () {
  "use strict";

  /* ---------- language toggle ---------- */
  var LANG_KEY = "nyfacade-lang";

  function setLang(lang) {
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      var active = btn.getAttribute("data-lang-btn") === lang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLang(btn.getAttribute("data-lang-btn"));
    });
  });

  (function initLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    setLang(saved === "en" ? "en" : "da");
  })();

  /* ---------- responsive mockup scaling ---------- */
  /* each frame (.mockup-frame or .compare) can contain more than one
     .mockup-scale layer (the hero compare stacks "before" + "after"), so
     every layer needs its own entry sharing the same frame's measured width */
  var scaleTargets = [];
  document.querySelectorAll(".mockup-scale").forEach(function (scaled) {
    var frame = scaled.closest(".mockup-frame") || scaled.closest(".compare");
    if (frame) scaleTargets.push({ frame: frame, scaled: scaled });
  });

  function applyScale(frameEl) {
    var base = parseFloat(frameEl.getAttribute("data-scale-base")) || 960;
    var scale = frameEl.clientWidth / base;
    scaleTargets.forEach(function (t) {
      if (t.frame === frameEl) t.scaled.style.transform = "scale(" + scale + ")";
    });
  }

  if (scaleTargets.length) {
    var frames = [];
    scaleTargets.forEach(function (t) {
      if (frames.indexOf(t.frame) === -1) frames.push(t.frame);
    });

    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) { applyScale(e.target); });
      });
      frames.forEach(function (f) { ro.observe(f); });
    } else {
      window.addEventListener("resize", function () {
        frames.forEach(applyScale);
      });
      frames.forEach(applyScale);
    }
  }

  /* ---------- hero before/after drag compare ---------- */
  var compare = document.querySelector("[data-compare]");
  if (compare) {
    var clip = compare.querySelector("[data-compare-clip]");
    var handle = compare.querySelector("[data-compare-handle]");
    var dragging = false;

    function setPos(pct) {
      pct = Math.max(1, Math.min(99, pct));
      clip.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
      handle.style.left = pct + "%";
      compare.setAttribute("aria-valuenow", String(Math.round(pct)));
    }

    function moveFromEvent(e) {
      var r = compare.getBoundingClientRect();
      var pct = ((e.clientX - r.left) / r.width) * 100;
      setPos(pct);
    }

    compare.addEventListener("pointerdown", function (e) {
      dragging = true;
      moveFromEvent(e);
    });
    window.addEventListener("pointermove", function (e) {
      if (dragging) moveFromEvent(e);
    });
    window.addEventListener("pointerup", function () { dragging = false; });

    compare.addEventListener("keydown", function (e) {
      var current = parseFloat(compare.getAttribute("aria-valuenow")) || 50;
      var step = e.shiftKey ? 10 : 4;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setPos(current - step); e.preventDefault(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") { setPos(current + step); e.preventDefault(); }
      else if (e.key === "Home") { setPos(1); e.preventDefault(); }
      else if (e.key === "End") { setPos(99); e.preventDefault(); }
    });
  }

  /* ---------- contact form ---------- */
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    var thanks = document.querySelector("[data-contact-thanks]");
    var submitBtn = form.querySelector("button[type=submit]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.classList.remove("has-error");
      submitBtn.disabled = true;

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (res.ok) {
            form.classList.add("hidden");
            thanks.classList.add("show");
          } else {
            form.classList.add("has-error");
            submitBtn.disabled = false;
          }
        })
        .catch(function () {
          form.classList.add("has-error");
          submitBtn.disabled = false;
        });
    });
  }
})();
