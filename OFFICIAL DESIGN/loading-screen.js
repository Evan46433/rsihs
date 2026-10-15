const loadingScreen = document.querySelector(".loading-screen");

if (loadingScreen) {
  const splashSeenKey = "roundsquare-splash-seen";
  let splashSeen = false;

  try {
    splashSeen = window.sessionStorage.getItem(splashSeenKey) === "true";
    window.sessionStorage.setItem(splashSeenKey, "true");
  } catch {
    // If storage is unavailable, keep the original first-load animation.
  }

  if (splashSeen) {
    loadingScreen.remove();
  } else {
    window.setTimeout(() => {
      loadingScreen.remove();
    }, 2800);
  }
}
