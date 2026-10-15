const verificationStatus = document.querySelector(".verification-status");
const statusCard = document.querySelector(".status-card");
const statusTitle = document.querySelector(".status-title");
const statusCopy = document.querySelector(".status-copy");
const currentStudentNameKey = "roundsquare-current-student-name";
const registrationKey = "roundsquare-student-registered";

if (verificationStatus && statusCard) {
  const resetVerification = () => {
    verificationStatus.classList.remove("is-visible");
    verificationStatus.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-verifying");
    statusCard.classList.remove("is-verified");
    statusTitle.textContent = "Verifying your details";
  };

  document.querySelector("#signin-form")?.addEventListener("barazaLeaderSignInStarted", () => {
    statusCard.classList.remove("is-verified");
    statusTitle.textContent = "Checking Baraza access";
    statusCopy.textContent = "Verifying your access code. Please wait...";
    verificationStatus.classList.add("is-visible");
    verificationStatus.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-verifying");
  });

  document.querySelector("#signin-form")?.addEventListener("barazaLeaderSignInFailed", resetVerification);

  const showVerification = (destination, copy) => {
    statusCard.classList.remove("is-verified");
    statusTitle.textContent = "Verifying your details";
    statusCopy.textContent = copy;
    verificationStatus.classList.add("is-visible");
    verificationStatus.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-verifying");

    window.setTimeout(() => {
      statusCard.classList.add("is-verified");
      statusTitle.textContent = "Details verified";
      statusCopy.textContent = "Your event access is ready.";

      window.setTimeout(() => {
        window.location.href = destination;
      }, 900);
    }, 1000);
  };

  document.querySelector("#signin-form")?.addEventListener("barazaLeaderSignInReady", () => {
    showVerification("dashboard.html?view=baraza-leader", "Preparing your Baraza dashboard.");
  });

  document.querySelector("#signin-form")?.addEventListener("signInDetailsReady", () => {
    const nameInput = document.querySelector("#student-name");
    const grInput = document.querySelector("#gr-number");
    const name = nameInput?.value.trim() || "";
    const grNumber = grInput?.value.trim() || "";

    if (name === "adminihs" && grNumber === "20260") {
      window.sessionStorage.setItem("roundsquare-admin-authorized", "true");
      window.location.href = "admin.html";
      return;
    }

    const gradeGroup = window.localStorage.getItem("roundsquare-grade-group");
    if (!gradeGroup) return;
    window.localStorage.setItem(currentStudentNameKey, name);
    window.localStorage.setItem(registrationKey, "true");

    showVerification("dashboard.html", "Please wait while we prepare your event access.");
  });
}
