const backgroundVideo = document.querySelector(".background-video");

const backgroundVideos = [
  "Videos/C6164.mp4",
  "Videos/C6159.mp4",
  "Videos/C6161.mp4",
];

const visibleDuration = 7000;
const pauseDuration = 3000;
let currentVideoIndex = 0;
let visibleTimer;
let pauseTimer;

const shouldDisableVideo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clearVideoTimers = () => {
  window.clearTimeout(visibleTimer);
  window.clearTimeout(pauseTimer);
};

const playNextVideo = () => {
  if (!backgroundVideo || shouldDisableVideo) return;

  clearVideoTimers();
  backgroundVideo.classList.remove("is-visible");

  const playVideo = () => {
    backgroundVideo.removeEventListener("error", skipVideo);
    backgroundVideo.currentTime = 0;
    backgroundVideo.play().catch(() => {
      backgroundVideo.classList.remove("is-visible");
    });
    requestAnimationFrame(() => backgroundVideo.classList.add("is-visible"));

    visibleTimer = window.setTimeout(() => {
      backgroundVideo.classList.remove("is-visible");
      backgroundVideo.pause();
      pauseTimer = window.setTimeout(() => {
        currentVideoIndex = (currentVideoIndex + 1) % backgroundVideos.length;
        playNextVideo();
      }, pauseDuration);
    }, visibleDuration);
  };

  const skipVideo = () => {
    backgroundVideo.removeEventListener("canplay", playVideo);
    currentVideoIndex = (currentVideoIndex + 1) % backgroundVideos.length;
    playNextVideo();
  };

  backgroundVideo.addEventListener("canplay", playVideo, { once: true });
  backgroundVideo.addEventListener("error", skipVideo, { once: true });
  backgroundVideo.src = backgroundVideos[currentVideoIndex];
  backgroundVideo.load();
};

if (backgroundVideo && !shouldDisableVideo) {
  playNextVideo();
}
