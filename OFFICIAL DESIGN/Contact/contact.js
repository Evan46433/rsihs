const currentYear = document.querySelector("#current-year");
const embeddedInDashboard = new URLSearchParams(window.location.search).get("embed") === "dashboard";

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

if (embeddedInDashboard) {
  document.documentElement.classList.add("dashboard-embedded");
  document.body.classList.add("dashboard-embedded");

  const reportHeight = () => {
    const content = document.querySelector(".contact-page");
    window.parent.postMessage({
      type: "roundsquare-dashboard-page-height",
      page: new URLSearchParams(window.location.search).get("page"),
      height: Math.ceil(content?.getBoundingClientRect().height || 0) + 2,
    }, window.location.origin === "null" ? "*" : window.location.origin);
  };

  const contactPage = document.querySelector(".contact-page");
  if (contactPage) new ResizeObserver(reportHeight).observe(contactPage);
  document.addEventListener("load", reportHeight, true);
  window.addEventListener("message", (event) => {
    if (event.source === window.parent && event.data?.type === "roundsquare-dashboard-page-height-request") reportHeight();
  });
  document.fonts?.ready.then(reportHeight);
  window.addEventListener("load", reportHeight, { once: true });
  reportHeight();
}
