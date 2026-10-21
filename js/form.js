(function () {
  "use strict";

  const FORMSPREE_ENDPOINT = "https://formspree.io/f/maeqrbzg";

  function getSelectedServiceRadio(form) {
    return form.querySelector('input[name="service-type"]:checked');
  }

  function getActivePanelId(form) {
    const radio = getSelectedServiceRadio(form);
    return radio ? radio.value : null;
  }

  function updateServicePanels(form) {
    const panelsWrap = form.querySelector("#form-panels");
    const panels = form.querySelectorAll(".form-panel");
    const selected = getSelectedServiceRadio(form);

    if (!panelsWrap) return;

    if (!selected) {
      panelsWrap.hidden = true;
      panels.forEach((panel) => {
        panel.hidden = true;
        panel.classList.remove("is-active");
      });
      return;
    }

    panelsWrap.hidden = false;
    const panelId = selected.value;

    panels.forEach((panel) => {
      const match = panel.dataset.panel === panelId;
      panel.hidden = !match;
      panel.classList.toggle("is-active", match);
    });
  }

  function initServiceRadios(form) {
    form.querySelectorAll('input[name="service-type"]').forEach((radio) => {
      radio.addEventListener("change", () => updateServicePanels(form));
    });
    form.addEventListener("reset", () => {
      requestAnimationFrame(() => updateServicePanels(form));
    });
    updateServicePanels(form);
  }

  function fieldLabel(el) {
    const span = el.closest("label")?.querySelector("span");
    return span ? span.textContent.trim() : el.name;
  }

  function collectFormData(form) {
    const panelId = getActivePanelId(form);
    if (!panelId) return null;

    const isEn = document.documentElement.lang === "en";
    const name = form.elements["first-and-last-name"]?.value?.trim() || "";
    const email = form.elements["your-email"]?.value?.trim() || "";
    const services = {
      transport: "Transport",
      skladistenje: "Skladištenje",
      carinjenje: "Carinjenje",
    };
    const service = services[panelId] || panelId;
    const data = {
      Usluga: service,
      email,
      name,
      company: form.elements.company?.value?.trim() || "",
      phone: form.elements["your-number"]?.value?.trim() || "",
      _subject: service + " — " + (isEn ? "TKA inquiry" : "TKA upit") + " — " + name,
      _gotcha: "",
    };

    const panel = form.querySelector(`[data-panel="${panelId}"]`);
    if (panel) {
      panel.querySelectorAll("input, textarea, select").forEach((el) => {
        if (!el.name || el.disabled) return;
        if (el.type === "checkbox" || el.type === "radio") return;
        const value = el.value?.trim() ?? "";
        if (!value) return;
        data[fieldLabel(el)] = value;
      });
    }

    return data;
  }

  function showStatus(form, message, type) {
    const box = form.querySelector("#form-status");
    if (!box) return;
    box.hidden = false;
    box.textContent = message;
    box.className = `form-status form-status--${type}`;
  }

  async function submitViaFormspree(data) {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body };
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form.classList.contains("inquiry-form")) return;

    event.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalLabel = btn.textContent;
    const isEn = document.documentElement.lang === "en";

    if (!getActivePanelId(form)) {
      showStatus(
        form,
        isEn
          ? "Please select a service to provide additional details."
          : "Odaberite uslugu kako biste popunili dodatne podatke.",
        "error"
      );
      return;
    }

    btn.disabled = true;
    btn.textContent = isEn ? "Sending…" : "Šaljem…";
    showStatus(form, "", "info");

    const payload = collectFormData(form);

    try {
      const result = await submitViaFormspree(payload);

      if (result.ok) {
        showStatus(
          form,
          isEn ? "Thank you! Your inquiry has been sent." : "Hvala! Vaš upit je uspešno poslat.",
          "success"
        );
        form.reset();
        updateServicePanels(form);
        const today = new Date().toISOString().slice(0, 10);
        const dateInput = form.elements["appointment-date"];
        if (dateInput) dateInput.min = today;
      } else {
        const errors = (Array.isArray(result.body.errors) ? result.body.errors : [])
          .map((item) => item.message)
          .filter(Boolean)
          .join(" ");
        showStatus(
          form,
          errors || (isEn ? "Something went wrong. Check the fields and try again." : "Greška pri slanju. Proverite polja i pokušajte ponovo."),
          "error"
        );
      }
    } catch {
      showStatus(
        form,
        isEn
          ? "The inquiry could not be sent. Email us at upiti@tka.rs or call us."
          : "Nije moguće poslati upit. Pišite nam na upiti@tka.rs ili pozovite telefonom.",
        "error"
      );
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("inquiry-form");
    if (!form) return;

    const dateInput = form.elements["appointment-date"];
    if (dateInput) {
      dateInput.min = new Date().toISOString().slice(0, 10);
    }

    initServiceRadios(form);
    form.addEventListener("submit", handleSubmit);
  });
})();
