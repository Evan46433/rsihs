if (new URLSearchParams(window.location.search).get("view") === "baraza-leader") {
  const { initializeBarazaLeaderDashboard } = await import("./baraza-leader-dashboard.js");
  await initializeBarazaLeaderDashboard();
} else {
  const [{ supabase }, { barazaRecords }] = await Promise.all([
    import("./supabase-client.js"),
    import("./baraza-data.js"),
  ]);

const dashboardLinks = document.querySelectorAll('.dashboard-nav a[href^="#"]:not([data-dashboard-page])');
const dashboardPageLinks = document.querySelectorAll("[data-dashboard-page]");
const sections = document.querySelectorAll("#home, #schedule, #speakers");
const agendaTabs = document.querySelectorAll(".agenda-tab");
const agendaPanels = document.querySelectorAll("[data-agenda-panel]");
const addCalendarButton = document.querySelector(".add-calendar-button");
const dashboardShell = document.querySelector(".dashboard-shell");
const settingsNavLink = document.querySelector(".settings-nav-link");
const moreNavItem = document.querySelector(".more-nav-item");
const moreNavButton = document.querySelector(".more-nav-button");
const moreMenu = document.querySelector(".more-menu");
const barazaNavLink = document.querySelector(".baraza-nav-link");
const settingsView = document.querySelector(".settings-view");
const dashboardSiteView = document.querySelector(".dashboard-site-view");
const dashboardSiteFrame = document.querySelector(".dashboard-site-frame");
const standardDashboardContent = document.querySelectorAll(".welcome-section, .baraza-banner, .event-strip, .resource-links, .event-countdown, .section-block, .quick-links, .dashboard-footer");
const reminderButton = document.querySelector(".reminder-button");
const reminderModal = document.querySelector(".reminder-modal");
const reminderClose = document.querySelector(".reminder-close");
const reminderStatus = document.querySelector(".reminder-status");
const confirmRemindersButton = document.querySelector(".confirm-reminders-button");
const reminderOptions = document.querySelectorAll("[data-reminder-schedule]");
const notificationCopy = document.querySelector(".notification-copy");
const noNotifications = document.querySelector(".no-notifications");
const notificationList = document.querySelector(".notification-list");
const notificationButton = document.querySelector(".notification-button");
const notificationBadge = document.querySelector(".notification-badge");
const notificationPanel = document.querySelector(".notification-panel");
const notificationClose = document.querySelector(".notification-close");
const notificationClearButton = document.querySelector(".notification-clear-button");
const notificationToast = document.querySelector(".notification-toast");
const notificationToastTitle = document.querySelector(".notification-toast-title");
const notificationToastMessage = document.querySelector(".notification-toast-message");
const signOutLink = document.querySelector(".sign-out-link");
const studentName = document.querySelector("#student-name");
const timeGreeting = document.querySelector("#time-greeting");
const currentStudentNameKey = "roundsquare-current-student-name";
const gradeGroupKey = "roundsquare-grade-group";
const registrationKey = "roundsquare-student-registered";
const reminderScheduleKey = "roundsquare-reminder-schedule";
const reminderHistoryKey = "roundsquare-reminder-history";
const unreadNotificationsKey = "roundsquare-unread-notifications";
const reminderTimers = [];
const welcomeCarouselSlides = document.querySelectorAll(".welcome-slide");
let unreadNotifications = Number(window.localStorage.getItem(unreadNotificationsKey) || 0);
let notificationToastTimer;
let notificationToastStartX = null;
let selectedReminderSchedule = window.localStorage.getItem(reminderScheduleKey);
let welcomeCarouselIndex = 0;
let welcomeCarouselPendingIndex = null;
const gradeGroup = window.localStorage.getItem(gradeGroupKey);
const gradeConfig = {
  "5-7": { baraza: "King Constantine", schedule: "junior", scheduleLabel: "Junior", label: "Grades 5–7 · Junior" },
  "8-9": { baraza: "Roy McComish", schedule: "intermediate", scheduleLabel: "Intermediate", label: "Grades 8–9 · Intermediate" },
  "10-12": { baraza: "Kurt Hahn", schedule: "intermediate", scheduleLabel: "Senior", label: "Grades 10–12 · Senior" },
};
const studentConfig = gradeConfig[gradeGroup] || gradeConfig["5-7"];
const delegateAlert = document.querySelector("[data-delegate-deadline]");
const directoryView = document.querySelector(".baraza-directory-view");
const profileView = document.querySelector(".baraza-profile-view");
const directoryGrid = document.querySelector("[data-baraza-directory]");
const dashboardViews = document.querySelectorAll(".dashboard-shell > section, .dashboard-shell > .resource-links, .dashboard-shell > .quick-links, .dashboard-shell > .dashboard-footer");
const reminderSchedules = {
  intermediate: [
    ["09:00", "Registration"], ["09:30", "Opening Ceremony"], ["10:30", "Baraza Session 1"],
    ["12:40", "Lunch"], ["13:30", "Keynote Speaker"], ["14:00", "Creative Expression Session"],
    ["14:30", "Photo Sessions"], ["15:00", "Baraza Session 2"], ["16:30", "Team Dance"],
    ["17:45", "Dispersal"],
  ],
  junior: [
    ["09:00", "Registration"], ["09:30", "Opening Ceremony"], ["10:30", "Scavenger Hunt"],
    ["11:40", "Baraza Session 1"], ["12:40", "Lunch"], ["13:30", "Keynote Speaker"],
    ["14:00", "Creative Expression Session"], ["14:30", "Photo Sessions"], ["15:00", "Baraza Session 2"],
    ["16:30", "Team Dance"], ["17:45", "Dispersal"],
  ],
};

if (timeGreeting) {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12
    ? "morning"
    : hour >= 12 && hour < 17
      ? "afternoon"
      : hour >= 17 && hour < 21
        ? "evening"
        : "night";
  timeGreeting.textContent = greeting;
}

if (studentName) {
  const name = window.localStorage.getItem(currentStudentNameKey);
  if (name) studentName.textContent = `${name}.`;
}

const eventCountdown = document.querySelector(".event-countdown");
const countdownUnits = document.querySelectorAll("[data-countdown-unit]");
const countdownTitle = document.querySelector("#countdown-title");
const countdownEyebrow = document.querySelector("[data-countdown-eyebrow]");
const countdownNote = document.querySelector(".countdown-note");
const celebrationDismissCountdown = document.querySelector("[data-celebration-dismiss-countdown]");
const celebrationDismissTimer = document.querySelector("[data-celebration-dismiss-timer]");
const countdownConfetti = document.querySelector(".countdown-confetti");
const eventStartTimestamp = Date.parse("2026-10-17T09:00:00+04:00");
const celebrationDuration = 15 * 60 * 1000;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let celebrationInterval;
let celebrationDismissTimeout;
let eventCountdownUpdateInterval;
let confettiFrame;
let currentCelebrationKey;

const drawCountdownConfetti = () => {
  if (!countdownConfetti || reducedMotion) return;

  const context = countdownConfetti.getContext("2d");
  if (!context) {
    console.error("Unable to initialize countdown celebration confetti.");
    return;
  }

  const startedAt = performance.now();
  const duration = 7000;
  const colors = ["#4ade80", "#a3e635", "#f2be55", "#f4ebdd", "#34d399"];
  const particles = [];
  let burstCount = 0;
  const resizeCanvas = () => {
    const bounds = countdownConfetti.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    countdownConfetti.width = Math.round(bounds.width * pixelRatio);
    countdownConfetti.height = Math.round(bounds.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };
  const burst = () => {
    const width = countdownConfetti.clientWidth;
    for (let index = 0; index < 60; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: -10 - Math.random() * 80,
        velocityX: (Math.random() - 0.5) * 2.8,
        velocityY: 1.5 + Math.random() * 3.5,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  };
  const animate = (now) => {
    const elapsed = now - startedAt;
    const width = countdownConfetti.clientWidth;
    const height = countdownConfetti.clientHeight;
    context.clearRect(0, 0, width, height);
    if (elapsed < duration && Math.floor(elapsed / 1700) > burstCount) {
      burstCount += 1;
      burst();
    }
    particles.forEach((particle) => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.velocityY += 0.035;
      particle.rotation += particle.rotationSpeed;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62);
      context.restore();
    });
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      if (particles[index].y > height + 12) particles.splice(index, 1);
    }
    if (elapsed < duration || particles.length) {
      confettiFrame = window.requestAnimationFrame(animate);
    } else {
      context.clearRect(0, 0, width, height);
      confettiFrame = undefined;
    }
  };

  resizeCanvas();
  burst();
  window.addEventListener("resize", resizeCanvas, { once: true });
  confettiFrame = window.requestAnimationFrame(animate);
};

const dismissEventCountdown = () => {
  if (!eventCountdown || eventCountdown.hidden || eventCountdown.classList.contains("is-dismissing")) return;
  currentCelebrationKey = undefined;
  eventCountdown.classList.add("is-dismissing");
  eventCountdown.setAttribute("aria-hidden", "true");
  celebrationDismissCountdown.hidden = true;
  window.setTimeout(() => {
    eventCountdown.hidden = true;
  }, 850);
};

const beginCountdownCelebration = (dismissAt) => {
  if (!eventCountdown) return;
  const celebrationKey = `event:${dismissAt}`;
  if (currentCelebrationKey === celebrationKey && eventCountdown.classList.contains("is-celebrating")) return;
  currentCelebrationKey = celebrationKey;
  if (celebrationInterval) window.clearInterval(celebrationInterval);
  if (celebrationDismissTimeout) window.clearTimeout(celebrationDismissTimeout);
  if (confettiFrame) window.cancelAnimationFrame(confettiFrame);

  eventCountdown.hidden = false;
  eventCountdown.removeAttribute("aria-hidden");
  eventCountdown.classList.remove("is-dismissing");
  eventCountdown.classList.add("is-celebrating");
  countdownEyebrow.textContent = "ROUND SQUARE 2026 · EVENT DAY";
  countdownTitle.textContent = "Round Square is now underway.";
  countdownNote.textContent = "Welcome to the Pursuit of Happiness at The Indian High School.";
  countdownUnits.forEach((unit) => { unit.textContent = "00"; });
  celebrationDismissCountdown.hidden = false;
  drawCountdownConfetti();

  const updateDismissTimer = () => {
    const remaining = Math.max(0, dismissAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    celebrationDismissTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (remaining <= 0) {
      window.clearInterval(celebrationInterval);
      celebrationInterval = undefined;
      dismissEventCountdown();
    }
  };

  updateDismissTimer();
  celebrationInterval = window.setInterval(updateDismissTimer, 1000);
  celebrationDismissTimeout = window.setTimeout(() => dismissEventCountdown(), Math.max(0, dismissAt - Date.now()));
};

const updateEventCountdown = () => {
  if (!eventCountdown || !countdownUnits.length) return;
  const now = Date.now();
  if (now >= eventStartTimestamp) {
    window.clearInterval(eventCountdownUpdateInterval);
    eventCountdownUpdateInterval = undefined;
    countdownUnits.forEach((unit) => { unit.textContent = "00"; });
    if (now < eventStartTimestamp + celebrationDuration) {
      beginCountdownCelebration(eventStartTimestamp + celebrationDuration);
    }
    dismissEventCountdown();
    return;
  }

  const totalSeconds = Math.floor((eventStartTimestamp - now) / 1000);
  const values = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
  countdownUnits.forEach((unit) => {
    unit.textContent = String(values[unit.dataset.countdownUnit]).padStart(2, "0");
  });
};

if (eventCountdown) {
  updateEventCountdown();
  if (!eventCountdown.classList.contains("is-celebrating")
    && !eventCountdown.classList.contains("is-dismissing")
    && !eventCountdown.hidden) {
    eventCountdownUpdateInterval = window.setInterval(updateEventCountdown, 1000);
  }
}

document.querySelector("#baraza-title")?.replaceChildren(document.createTextNode(studentConfig.baraza));
document.querySelector("#baraza-subtitle")?.replaceChildren(document.createTextNode(studentConfig.label));
document.querySelector("#intermediate-tab")?.replaceChildren(document.createTextNode(studentConfig.scheduleLabel));
document.querySelector(`[data-reminder-schedule="${studentConfig.schedule}"] strong`)?.replaceChildren(document.createTextNode(studentConfig.scheduleLabel));

if (welcomeCarouselSlides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.setInterval(() => {
    if (welcomeCarouselPendingIndex !== null) return;
    const nextIndex = (welcomeCarouselIndex + 1) % welcomeCarouselSlides.length;
    const nextSlide = welcomeCarouselSlides[nextIndex];
    const activateNextSlide = () => {
      welcomeCarouselSlides[welcomeCarouselIndex].classList.remove("is-active");
      welcomeCarouselIndex = nextIndex;
      nextSlide.classList.add("is-active");
      welcomeCarouselPendingIndex = null;
    };

    if (!nextSlide.hasAttribute("src") && nextSlide.dataset.src) {
      welcomeCarouselPendingIndex = nextIndex;
      nextSlide.addEventListener("load", activateNextSlide, { once: true });
      nextSlide.addEventListener("error", () => {
        console.error(`Unable to load dashboard carousel image: ${nextSlide.dataset.src}`);
        welcomeCarouselPendingIndex = null;
      }, { once: true });
      nextSlide.src = nextSlide.dataset.src;
      return;
    }

    activateNextSlide();
  }, 5000);
}

if (delegateAlert) {
  const deadlineTimestamp = Date.parse(delegateAlert.dataset.delegateDeadline || "");
  const countdown = delegateAlert.querySelector("[data-delegate-countdown]");

  if (!Number.isFinite(deadlineTimestamp) || !countdown) {
    console.error("The delegate application alert is missing a valid deadline or countdown element.");
    delegateAlert.hidden = true;
  } else {
    let deadlineTimer;
    const updateDelegateDeadline = () => {
      const remainingSeconds = Math.ceil((deadlineTimestamp - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        delegateAlert.hidden = true;
        window.clearInterval(deadlineTimer);
        return;
      }

      const days = Math.floor(remainingSeconds / 86400);
      const hours = Math.floor((remainingSeconds % 86400) / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      const pad = (value) => String(value).padStart(2, "0");
      countdown.textContent = days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
        : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
      countdown.setAttribute(
        "aria-label",
        `${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds remaining`,
      );
    };

    updateDelegateDeadline();
    if (!delegateAlert.hidden) deadlineTimer = window.setInterval(updateDelegateDeadline, 1000);
  }
}

const setActiveLink = (id) => {
  dashboardLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
  });
};

const closeMoreMenu = ({ restoreFocus = false } = {}) => {
  moreNavButton?.setAttribute("aria-expanded", "false");
  moreMenu?.setAttribute("aria-hidden", "true");
  moreMenu?.classList.remove("is-open");
  if (restoreFocus) moreNavButton?.focus();
};

const showBarazaView = (view) => {
  dashboardViews.forEach((item) => {
    if (item === directoryView || item === profileView) return;
    item.hidden = view !== "dashboard" && !(view === "settings" && item === settingsView);
  });
  directoryView.hidden = view !== "directory";
  profileView.hidden = view !== "profile";
  if (view === "settings") {
    dashboardShell?.classList.add("is-settings");
    settingsView.hidden = false;
  } else {
    dashboardShell?.classList.remove("is-settings");
    settingsView.hidden = true;
  }
  dashboardShell?.classList.toggle("is-baraza-view", view === "directory" || view === "profile");
  document.body.classList.toggle("is-baraza-view", view === "directory" || view === "profile");
  dashboardShell?.classList.toggle("is-site-view", view === "about" || view === "contact");
  if (dashboardSiteView) dashboardSiteView.hidden = view !== "about" && view !== "contact";
  barazaNavLink?.classList.toggle("is-active", view === "directory" || view === "profile");
  settingsNavLink?.classList.toggle("is-active", view === "settings");
  moreNavButton?.classList.toggle("is-active", view === "settings" || view === "contact");
  dashboardPageLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.dashboardPage === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const displayLeader = (name) => name || "To be confirmed";
const renderProfile = (record) => {
  const ribbonColor = record.ribbon?.toLowerCase().replaceAll(" ", "-") || "none";
  profileView.dataset.ribbon = ribbonColor;
  document.querySelector("#profile-title").textContent = record.happiness;
  document.querySelector("#profile-language").textContent = record.language;
  document.querySelector("#profile-level").textContent = record.level;
  const profileRibbon = document.querySelector("#profile-ribbon");
  profileRibbon.hidden = !record.ribbon;
  if (record.ribbon) {
    document.querySelector("#profile-ribbon-name").textContent = record.ribbon;
    profileRibbon.dataset.ribbon = ribbonColor;
  } else {
    delete profileRibbon.dataset.ribbon;
    document.querySelector("#profile-ribbon-name").textContent = "";
  }
  document.querySelector("#profile-head").textContent = displayLeader(record.head);
  [record.coLeaders[0], record.coLeaders[1]].forEach((name, index) => {
    const leader = document.querySelector(`#profile-co-${index === 0 ? "one" : "two"}`);
    leader.textContent = displayLeader(name);
    leader.parentElement.hidden = !name;
  });
};

const openProfile = (record) => {
  renderProfile(record);
  showBarazaView("profile");
};

if (directoryGrid) {
  directoryGrid.replaceChildren(...barazaRecords.map((record) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "baraza-directory-card";
    card.dataset.ribbon = record.ribbon?.toLowerCase().replaceAll(" ", "-") || "none";
    const number = document.createElement("span");
    number.className = "directory-number";
    number.textContent = String(record.id).padStart(2, "0");
    const happiness = document.createElement("strong");
    happiness.textContent = record.happiness;
    const details = document.createElement("small");
    details.textContent = `${record.language} · ${record.level}`;
    const head = document.createElement("small");
    head.className = "directory-head";
    head.textContent = `Head: ${displayLeader(record.head)}`;
    const cardContent = [number, happiness, details];
    if (record.ribbon) {
      const ribbon = document.createElement("span");
      ribbon.className = "directory-ribbon";
      ribbon.dataset.ribbon = record.ribbon.toLowerCase().replaceAll(" ", "-");
      const ribbonSwatch = document.createElement("i");
      ribbonSwatch.setAttribute("aria-hidden", "true");
      const ribbonName = document.createElement("span");
      ribbonName.textContent = `${record.ribbon} Ribbon`;
      ribbon.append(ribbonSwatch, ribbonName);
      cardContent.push(ribbon);
    }
    card.append(...cardContent, head);
    card.addEventListener("click", () => openProfile(record));
    return card;
  }));
}

document.querySelector("[data-open-your-baraza]")?.addEventListener("click", () => {
  showBarazaView("directory");
  setActiveLink("");
});
document.querySelectorAll("[data-open-baraza-directory]").forEach((button) => {
  button.addEventListener("click", () => {
    showBarazaView("directory");
    setActiveLink("");
  });
});
document.querySelector("[data-return-dashboard]")?.addEventListener("click", () => showBarazaView("dashboard"));
barazaNavLink?.addEventListener("click", () => {
  showBarazaView("directory");
  setActiveLink("");
});

if (sections.length && "IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visibleSection = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
    if (visibleSection) setActiveLink(visibleSection.target.id);
  }, { rootMargin: "-20% 0px -60% 0px", threshold: [0, .25, .6] });

  sections.forEach((section) => sectionObserver.observe(section));
}

dashboardLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showBarazaView("dashboard");
    dashboardShell?.classList.remove("is-settings");
    if (settingsView) settingsView.hidden = true;
    standardDashboardContent.forEach((content) => {
      content.hidden = false;
    });
    settingsNavLink?.classList.remove("is-active");
    barazaNavLink?.classList.remove("is-active");
    setActiveLink(link.getAttribute("href").slice(1));
    const target = document.querySelector(link.getAttribute("href"));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

moreNavButton?.addEventListener("click", () => {
  const isOpen = moreNavButton.getAttribute("aria-expanded") === "true";
  if (isOpen) {
    closeMoreMenu();
    return;
  }

  moreMenu?.setAttribute("aria-hidden", "false");
  moreNavButton.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => moreMenu?.classList.add("is-open"));
});

document.addEventListener("click", (event) => {
  if (!moreNavItem?.contains(event.target)) closeMoreMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && moreNavButton?.getAttribute("aria-expanded") === "true") {
    closeMoreMenu({ restoreFocus: true });
  }
});

settingsNavLink?.addEventListener("click", () => {
  closeMoreMenu();
  showBarazaView("settings");
  dashboardShell?.classList.add("is-settings");
  standardDashboardContent.forEach((content) => {
    content.hidden = true;
  });
  if (settingsView) settingsView.hidden = false;
  dashboardLinks.forEach((link) => link.classList.remove("is-active"));
  barazaNavLink?.classList.remove("is-active");
  settingsNavLink.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

dashboardPageLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const page = link.dataset.dashboardPage;
    if (page !== "about" && page !== "contact") return;

    closeMoreMenu();
    showBarazaView(page);
    dashboardSiteView?.setAttribute("aria-label", page === "about" ? "About Roundsquare" : "Contact Roundsquare");
    if (dashboardSiteFrame) {
      dashboardSiteFrame.title = page === "about" ? "About Roundsquare" : "Contact Roundsquare";
      dashboardSiteFrame.style.height = "";
      dashboardSiteFrame.src = `${page === "about" ? "About/index.html" : "Contact/index.html"}?embed=dashboard&page=${page}`;
    }
  });
});

window.addEventListener("message", (event) => {
  const isExpectedOrigin = event.origin === window.location.origin
    || (window.location.protocol === "file:" && event.origin === "null");
  if (!isExpectedOrigin || event.source !== dashboardSiteFrame?.contentWindow) return;
  if (event.data?.type !== "roundsquare-dashboard-page-height") return;

  let currentPage;
  try {
    currentPage = new URL(dashboardSiteFrame.contentWindow.location.href).searchParams.get("page");
  } catch (error) {
    console.error("Unable to identify the embedded dashboard page.", error);
    return;
  }
  if (event.data.page !== currentPage || !["about", "contact"].includes(currentPage) || !Number.isFinite(event.data.height)) return;

  dashboardPageLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.dashboardPage === currentPage);
  });
  dashboardSiteView?.setAttribute("aria-label", currentPage === "about" ? "About Roundsquare" : "Contact Roundsquare");
  dashboardSiteFrame.style.height = `${Math.max(500, Math.ceil(event.data.height))}px`;
});

dashboardSiteFrame?.addEventListener("load", () => {
  const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
  dashboardSiteFrame.contentWindow?.postMessage({ type: "roundsquare-dashboard-page-height-request" }, targetOrigin);
});

agendaTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const selectedAgenda = tab.dataset.agenda;

    agendaTabs.forEach((agendaTab) => {
      const isSelected = agendaTab === tab;
      agendaTab.classList.toggle("is-active", isSelected);
      agendaTab.setAttribute("aria-selected", String(isSelected));
    });

    agendaPanels.forEach((panel) => {
      const isSelected = panel.dataset.agendaPanel === selectedAgenda;
      panel.hidden = !isSelected;
      panel.classList.toggle("is-visible", isSelected);
    });
  });

});

const setStudentAgenda = (scheduleName) => {
  agendaTabs.forEach((tab) => {
    tab.hidden = tab.dataset.agenda !== scheduleName;
  });
  const selectedTab = document.querySelector(`.agenda-tab[data-agenda="${scheduleName}"]`);
  selectedTab?.click();
};
setStudentAgenda(studentConfig.schedule);

const getReminderHistory = () => JSON.parse(window.localStorage.getItem(reminderHistoryKey) || "[]");
const saveReminderHistory = (history) => window.localStorage.setItem(reminderHistoryKey, JSON.stringify(history.slice(-8)));

const updateNotificationBadge = () => {
  if (!notificationBadge) return;
  notificationBadge.textContent = unreadNotifications > 99 ? "99+" : String(unreadNotifications);
  notificationBadge.hidden = unreadNotifications === 0;
  notificationBadge.setAttribute("aria-label", `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}`);
};

const showNotificationToast = (title, message) => {
  if (!notificationToast || notificationPanel?.classList.contains("is-open")) return;
  notificationToastTitle.textContent = title;
  notificationToastMessage.textContent = message;
  notificationToast.classList.remove("is-dismissing");
  notificationToast.classList.add("is-visible");
  notificationToast.setAttribute("aria-hidden", "false");
  window.clearTimeout(notificationToastTimer);
  notificationToastTimer = window.setTimeout(() => {
    notificationToast.classList.remove("is-visible");
    notificationToast.setAttribute("aria-hidden", "true");
  }, 5000);
};

notificationToast?.addEventListener("touchstart", (event) => {
  notificationToastStartX = event.touches[0].clientX;
}, { passive: true });

notificationToast?.addEventListener("touchend", (event) => {
  if (notificationToastStartX === null) return;
  const distance = event.changedTouches[0].clientX - notificationToastStartX;
  notificationToastStartX = null;
  if (Math.abs(distance) < 60) return;
  window.clearTimeout(notificationToastTimer);
  notificationToast.classList.add("is-dismissing");
  window.setTimeout(() => {
    notificationToast.classList.remove("is-visible", "is-dismissing");
    notificationToast.setAttribute("aria-hidden", "true");
  }, 220);
});

const addUnreadNotification = (title, message) => {
  unreadNotifications += 1;
  window.localStorage.setItem(unreadNotificationsKey, String(unreadNotifications));
  updateNotificationBadge();
  showNotificationToast(title, message);
};

updateNotificationBadge();

const renderReminderNotifications = async () => {
  const history = getReminderHistory();
  let adminMessages = [];
  try {
    const { data, error } = await supabase
      .from("admin_messages")
    .select("id, title, message, content, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    adminMessages = data || [];
  } catch (error) {
    console.error("Unable to load admin messages.", error);
  }
  if (!history.length && !adminMessages.length) {
    if (noNotifications) noNotifications.textContent = "NO NOTIFICATIONS";
    if (notificationList) notificationList.innerHTML = '<p class="notification-empty">You are all caught up for now.</p>';
    return;
  }

  if (noNotifications) noNotifications.textContent = adminMessages.length ? "UPDATES & REMINDERS" : "SCHEDULE REMINDERS";
  if (notificationList) {
    const reminderItems = history.slice(-6).reverse().map((entry) => {
      const item = typeof entry === "string" ? { message: entry, timestamp: Date.now() } : entry;
      return { title: "Roundsquare reminder", message: item.message, timestamp: item.timestamp };
    });
    const messageItems = adminMessages.slice(0, 6).map((item) => ({
      title: item.title,
      message: item.message || item.content,
      timestamp: item.created_at,
    }));
    notificationList.replaceChildren(...[...messageItems, ...reminderItems].map((item) => {
      const card = document.createElement("article");
      card.className = "notification-item";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const message = document.createElement("span");
      message.textContent = item.message;
      const time = document.createElement("time");
      time.dateTime = new Date(item.timestamp).toISOString();
      time.textContent = new Date(item.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      card.append(title, message, time);
      return card;
    }));
  }
};

const addReminderNotification = (message) => {
  const history = getReminderHistory();
  history.push({ message, timestamp: Date.now() });
  saveReminderHistory(history);
  addUnreadNotification("Roundsquare reminder", message);
  renderReminderNotifications();
};

renderReminderNotifications();
supabase
  .channel("student-admin-messages")
  .on("postgres_changes", { event: "*", schema: "public", table: "admin_messages" }, (payload) => {
    renderReminderNotifications();
    if (payload.eventType === "INSERT" && payload.new) {
      addUnreadNotification(payload.new.title || "New update", payload.new.message || payload.new.content || "");
    }
  })
  .subscribe();


const showBrowserNotification = (title, body) => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "Images/ihslogo.png" });
  }
};

const clearScheduledReminders = () => {
  reminderTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
};

const scheduleReminders = (scheduleName) => {
  clearScheduledReminders();
  reminderSchedules[scheduleName].forEach(([time, title]) => {
    const [hour, minute] = time.split(":").map(Number);
    const eventDate = new Date(2026, 9, 17, hour, minute);
    const delay = eventDate.getTime() - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => {
      const message = `${studentConfig.scheduleLabel}: ${title}`;
      addReminderNotification(message);
      showBrowserNotification("Roundsquare reminder", message);
    }, delay);
    reminderTimers.push(timer);
  });
};

const requestReminders = async (scheduleName) => {
  let browserNotificationsEnabled = !("Notification" in window);
  if ("Notification" in window && Notification.permission !== "granted") {
    try {
      const permission = await Notification.requestPermission();
      browserNotificationsEnabled = permission === "granted";
    } catch (error) {
      browserNotificationsEnabled = false;
      reminderStatus.textContent = "Browser notifications are unavailable. In-dashboard reminders are still enabled.";
    }
  } else if ("Notification" in window) {
    browserNotificationsEnabled = Notification.permission === "granted";
  }
  window.localStorage.setItem(reminderScheduleKey, scheduleName);
  scheduleReminders(scheduleName);
  reminderStatus.textContent = browserNotificationsEnabled
    ? `${studentConfig.scheduleLabel} reminders are ready.`
    : "Reminders saved. In-dashboard alerts are enabled; browser notifications are not allowed.";
  window.setTimeout(() => reminderModal.classList.remove("is-open"), 700);
};

const clearReminders = () => {
  clearScheduledReminders();
  window.localStorage.removeItem(reminderScheduleKey);
  window.localStorage.removeItem(reminderHistoryKey);
  selectedReminderSchedule = null;
  reminderOptions.forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  renderReminderNotifications();
  reminderStatus.textContent = "All reminders have been cleared.";
};

const selectReminderSchedule = (scheduleName) => {
  if (!reminderSchedules[scheduleName]) return;
  selectedReminderSchedule = scheduleName;
  reminderOptions.forEach((button) => {
    const isSelected = button.dataset.reminderSchedule === scheduleName;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

reminderButton?.addEventListener("click", () => {
  selectReminderSchedule(selectedReminderSchedule);
  reminderModal.classList.add("is-open");
});
reminderClose?.addEventListener("click", () => reminderModal.classList.remove("is-open"));
reminderOptions.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectReminderSchedule(button.dataset.reminderSchedule));
});
confirmRemindersButton?.addEventListener("click", () => {
  if (!selectedReminderSchedule) {
    reminderStatus.textContent = "Choose one schedule before confirming.";
    return;
  }
  requestReminders(selectedReminderSchedule);
});
notificationClearButton?.addEventListener("click", clearReminders);

const savedReminderSchedule = window.localStorage.getItem(reminderScheduleKey);
const studentSchedule = studentConfig.schedule;
reminderOptions.forEach((button) => {
  button.hidden = button.dataset.reminderSchedule !== studentSchedule;
});
if (savedReminderSchedule && savedReminderSchedule === studentSchedule && reminderSchedules[savedReminderSchedule]) {
  selectReminderSchedule(savedReminderSchedule);
  scheduleReminders(savedReminderSchedule);
}

const pad = (value) => String(value).padStart(2, "0");
const escapeCalendarText = (value) => String(value)
  .replace(/\\/g, "\\\\")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,")
  .replace(/\r?\n/g, "\\n");

const calendarMinutes = (time, minimumMinutes = 0) => {
  const match = time.trim().match(/^(\d+):(\d+)(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (!meridiem && hour < 12 && hour * 60 + minute < minimumMinutes) hour += 12;
  return hour * 60 + minute;
};

const calendarTime = (minutes) => {
  const hour = Math.floor(minutes / 60) % 24;
  return `${pad(hour)}${pad(minutes % 60)}00`;
};

const createCalendarFile = () => {
  const selectedPanel = document.querySelector("[data-agenda-panel].is-visible") ||
    document.querySelector("[data-agenda-panel]:not([hidden])");
  if (!selectedPanel) return;

  const selectedTab = document.querySelector(".agenda-tab.is-active");
  const agendaName = selectedTab?.textContent.trim() || "Event";
  let previousStart = 0;
  const events = [...selectedPanel.querySelectorAll(".agenda-row")].map((row) => {
    const timeParts = row.querySelector("time")?.textContent.trim().split("–").map((part) => part.trim()) || [];
    const startMinutes = calendarMinutes(timeParts[0], previousStart);
    const endMinutes = timeParts[1] ? calendarMinutes(timeParts[1], startMinutes) : startMinutes + 15;
    const title = row.querySelector(":scope > span")?.textContent.trim() || "Event activity";
    if (startMinutes === null || endMinutes === null) return null;

    previousStart = startMinutes;
    return [
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}@roundsquare`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:20261017T${calendarTime(startMinutes)}`,
      `DTEND:20261017T${calendarTime(endMinutes)}`,
      `SUMMARY:${escapeCalendarText(`${agendaName}: ${title}`)}`,
      "LOCATION:The Indian High School, Dubai",
      "END:VEVENT",
    ].join("\r\n");
  }).filter(Boolean);

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roundsquare//Pursuit of Happiness 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
  const blobUrl = URL.createObjectURL(new Blob([`${calendar}\r\n`], { type: "text/calendar;charset=utf-8" }));
  const downloadLink = document.createElement("a");
  downloadLink.href = blobUrl;
  downloadLink.download = `${agendaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-schedule.ics`;
  downloadLink.click();
  URL.revokeObjectURL(blobUrl);
};

addCalendarButton?.addEventListener("click", createCalendarFile);

const toggleNotifications = (isOpen) => {
  renderReminderNotifications();
  notificationPanel.classList.toggle("is-open", isOpen);
  notificationPanel.setAttribute("aria-hidden", String(!isOpen));
  notificationButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen && notificationToast) {
    window.clearTimeout(notificationToastTimer);
    notificationToast.classList.remove("is-visible", "is-dismissing");
    notificationToast.setAttribute("aria-hidden", "true");
  }
  if (isOpen) {
    unreadNotifications = 0;
    window.localStorage.removeItem(unreadNotificationsKey);
    updateNotificationBadge();
  }
};

notificationButton?.addEventListener("click", () => {
  toggleNotifications(!notificationPanel.classList.contains("is-open"));
});
notificationClose?.addEventListener("click", () => toggleNotifications(false));
signOutLink?.addEventListener("click", () => {
  window.localStorage.removeItem(currentStudentNameKey);
  window.localStorage.removeItem(gradeGroupKey);
  window.localStorage.removeItem(registrationKey);
  window.sessionStorage.removeItem("roundsquare-admin-authorized");
  window.location.href = "signin.html";
});
}
