const menuToggle = document.querySelector(".menu-toggle");
const primaryNavigation = document.querySelector("#primary-navigation");
const currentYear = document.querySelector("#current-year");
const registrationKey = "roundsquare-student-registered";
const isRegistered = window.localStorage.getItem(registrationKey) === "true";

if (currentYear) currentYear.textContent = new Date().getFullYear();

const accessPanelHeading = document.querySelector(".panel-kicker");
const accessPanelCopy = document.querySelector(".panel-copy");
const accessPanelButton = document.querySelector(".panel-button");

if (isRegistered && accessPanelHeading && accessPanelCopy && accessPanelButton) {
  accessPanelHeading.textContent = "WELCOME BACK";
  accessPanelHeading.nextElementSibling.textContent = "Your event access is ready.";
  accessPanelCopy.textContent = "Return to your Roundsquare dashboard and continue exploring the event.";
  accessPanelButton.href = "dashboard.html";
  accessPanelButton.innerHTML = 'Open dashboard <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
}

const marqueeMessage = document.querySelector(".marquee-message span");
const marqueePhrases = [
  "Authentic experiences all around",
  "17 October 2026",
  "Are we happy only because we feel good?",
  "Join the Barazas",
];

if (marqueeMessage) {
  let phraseIndex = 0;
  window.setInterval(() => {
    phraseIndex = (phraseIndex + 1) % marqueePhrases.length;
    marqueeMessage.classList.add("is-changing");
    window.setTimeout(() => {
      marqueeMessage.textContent = marqueePhrases[phraseIndex];
      marqueeMessage.classList.remove("is-changing");
    }, 220);
  }, 3000);
}

if (menuToggle && primaryNavigation) {
  const closeMenu = () => {
    primaryNavigation.classList.remove("is-open");
    menuToggle.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = primaryNavigation.classList.toggle("is-open");
    menuToggle.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  primaryNavigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("click", (event) => {
    if (primaryNavigation.classList.contains("is-open") &&
        !primaryNavigation.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });
}

document.querySelectorAll('a[href="signin.html"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const transition = document.createElement("div");
    transition.className = "page-transition";
    document.body.appendChild(transition);
    requestAnimationFrame(() => transition.classList.add("is-active"));

    window.setTimeout(() => {
      window.location.href = link.href;
    }, 320);
  });
});
