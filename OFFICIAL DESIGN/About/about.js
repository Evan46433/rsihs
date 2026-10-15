const currentYear = document.querySelector("#current-year");
const embeddedInDashboard = new URLSearchParams(window.location.search).get("embed") === "dashboard";

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

if (embeddedInDashboard) {
  document.documentElement.classList.add("dashboard-embedded");
  document.body.classList.add("dashboard-embedded");
  const contactLink = document.querySelector(".about-closing a[href$='../Contact/index.html']");
  if (contactLink) contactLink.href = "../Contact/index.html?embed=dashboard&page=contact";
}

const numberValues = document.querySelectorAll("[data-count]");
const animateNumbers = (element) => {
  const target = Number(element.dataset.count);
  const duration = 1400;
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) window.requestAnimationFrame(update);
  };
  window.requestAnimationFrame(update);
};

if (numberValues.length) {
  const numbersSection = document.querySelector(".numbers-section");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    numberValues.forEach((element) => { element.textContent = element.dataset.count; });
  } else if (numbersSection && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      numberValues.forEach(animateNumbers);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(numbersSection);
  } else {
    numberValues.forEach(animateNumbers);
  }
}

if (embeddedInDashboard) {
  const reportHeight = () => {
    const content = document.querySelector(".about-page");
    window.parent.postMessage({
      type: "roundsquare-dashboard-page-height",
      page: new URLSearchParams(window.location.search).get("page"),
      height: Math.ceil(content?.getBoundingClientRect().height || 0) + 2,
    }, window.location.origin === "null" ? "*" : window.location.origin);
  };

  const aboutPage = document.querySelector(".about-page");
  if (aboutPage) new ResizeObserver(reportHeight).observe(aboutPage);
  document.addEventListener("load", reportHeight, true);
  window.addEventListener("message", (event) => {
    if (event.source === window.parent && event.data?.type === "roundsquare-dashboard-page-height-request") reportHeight();
  });
  document.fonts?.ready.then(reportHeight);
  window.addEventListener("load", reportHeight, { once: true });
  reportHeight();
}
