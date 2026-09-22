(function () {
  "use strict";

  const CF7_ENDPOINT = "https://www.tka.rs/wp-json/contact-form-7/v1/contact-forms/10533/feedback";
  const PROXY_ENDPOINT = "/api/submit-inquiry.php";

  const SOLUTION_PAD = {
    transport: {
      "origin-destination": "-",
      "vehicle-type": "-",
      "specific-customs-type": "-",
      volume: "-",
      dimensions: "-",
    },
    skladistenje: {
      origin: "-",
      "origin-postal-code": "-",
      "origin-city": "-",
      destination: "-",
      "destination-postal-code": "-",
      "destination-city": "-",
      vrsta: "-",
      kolicina: "-",
      dimenzije: "-",
      tezina: "-",
      "appointment-date": new Date().toISOString().slice(0, 10),
      "origin-destination": "-",
      "vehicle-type": "-",
      "specific-customs-type": "-",
    },
    carinjenje: {
      origin: "-",
      "origin-postal-code": "-",
      "origin-city": "-",
      destination: "-",
      "destination-postal-code": "-",
      "destination-city": "-",
      vrsta: "-",
      kolicina: "-",
      dimenzije: "-",
      tezina: "-",
      "appointment-date": new Date().toISOString().slice(0, 10),
      volume: "-",
      dimensions: "-",
    },
  };

  function getSelectedServiceRadio(form) {
    return form.querySelector('input[name="service-type"]:checked');
  }

  function getActiveSolution(form) {
    const radio = getSelectedServiceRadio(form);
    return radio ? radio.dataset.solution : null;
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

  function collectFormData(form) {
    const panelId = getActivePanelId(form);
    if (!panelId) return null;
    const data = {
      "first-and-last-name": form.elements["first-and-last-name"]?.value?.trim(),
      company: form.elements.company?.value?.trim(),
      "your-number": form.elements["your-number"]?.value?.trim(),
      "your-email": form.elements["your-email"]?.value?.trim(),
      "solution[]": getActiveSolution(form),
    };

    const panel = form.querySelector(`[data-panel="${panelId}"]`);
    if (panel) {
      panel.querySelectorAll("input, textarea, select").forEach((el) => {
        if (!el.name || el.disabled) return;
        if (el.type === "checkbox" || el.type === "radio") return;
        data[el.name] = el.value?.trim() ?? "";
      });
    }

    const pad = SOLUTION_PAD[panelId] || {};
    Object.entries(pad).forEach(([key, value]) => {
      if (!data[key]) data[key] = value;
    });

    return data;
  }

  function showStatus(form, message, type) {
    const box = form.querySelector("#form-status");
    if (!box) return;
    box.hidden = false;
    box.textContent = message;
    box.className = `form-status form-status--${type}`;
  }

  async function submitViaProxy(data) {
    const res = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async function submitViaCf7(data) {
    const body = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key.endsWith("[]")) {
        body.append(key, value);
      } else {
        body.append(key, value);
      }
    });

    body.append("_wpcf7", "10533");
    body.append("_wpcf7_version", "6.0.4");
    body.append("_wpcf7_locale", "en_US");
    body.append("_wpcf7_unit_tag", "wpcf7-f10533-p11123-o1");
    body.append("_wpcf7_container_post", "11123");

    const res = await fetch(CF7_ENDPOINT, {
      method: "POST",
      body,
    });
    return res.json();
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
      let result;
      try {
        result = await submitViaProxy(payload);
      } catch {
        result = await submitViaCf7(payload);
      }

      if (result.status === "mail_sent") {
        showStatus(
          form,
          result.message || "Hvala! Vaš upit je uspešno poslat.",
          "success"
        );
        form.reset();
        updateServicePanels(form);
        const today = new Date().toISOString().slice(0, 10);
        const dateInput = form.elements["appointment-date"];
        if (dateInput) dateInput.min = today;
      } else {
        const errors = (result.invalid_fields || [])
          .map((f) => f.message)
          .filter(Boolean)
          .join(" ");
        showStatus(
          form,
          errors || result.message || "Greška pri slanju. Proverite polja i pokušajte ponovo.",
          "error"
        );
      }
    } catch {
      showStatus(
        form,
        "Nije moguće poslati upit. Pišite nam na kontakt@tka.rs ili pozovite telefonom.",
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
