import { supabaseAnonKey, supabaseUrl } from "./supabase-config.js";

const signInForm = document.querySelector("#signin-form");

if (signInForm) {
  const nameInput = document.querySelector("#student-name");
  const grInput = document.querySelector("#gr-number");
  const gradeModal = document.querySelector(".grade-modal");
  const gradeOptions = document.querySelectorAll("[data-grade-group]");
  const gradeContinueButton = document.querySelector(".grade-continue-button");
  const gradeStatus = document.querySelector(".grade-status");
  const status = document.querySelector(".form-status");
  const submitButton = signInForm.querySelector(".submit-button");
  const passwordToggle = document.querySelector(".password-toggle");
  const gradeAccessTokenKey = "roundsquare-baraza-leader-session";
  let selectedGradeGroup = null;

  nameInput.addEventListener("input", () => {
    nameInput.value = nameInput.value.replace(/[^\p{L}\p{M}' -]/gu, "").replace(/ {2,}/g, " ");
  });

  grInput.addEventListener("input", () => {
    grInput.value = grInput.value.replace(/\D/g, "").slice(0, 5);
  });

  passwordToggle?.addEventListener("click", () => {
    const showValue = grInput.type === "password";
    grInput.type = showValue ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(showValue));
    passwordToggle.setAttribute(
      "aria-label",
      `${showValue ? "Hide" : "Show"} GR number or Baraza access code`,
    );
    passwordToggle.innerHTML = `<i class="fa-regular fa-eye${showValue ? "-slash" : ""}" aria-hidden="true"></i>`;
  });

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = nameInput.value.normalize("NFKC").trim().replace(/\s+/g, " ");
    const grNumber = grInput.value.trim();
    const isBarazaLeader = fullName.toLocaleLowerCase("en") === "rsbaraza";
    const nameError = document.querySelector('[data-error-for="student-name"]');
    const grError = document.querySelector('[data-error-for="gr-number"]');

    [nameInput, grInput].forEach((input) => {
      input.removeAttribute("aria-invalid");
    });
    nameError.textContent = "";
    grError.textContent = "";
    status.textContent = "";

    if (isBarazaLeader) {
      if (!/^[0-9]{5}$/.test(grNumber)) {
        grInput.setAttribute("aria-invalid", "true");
        status.textContent = "Invalid name or access code. Please try again.";
        return;
      }

      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      let signInSucceeded = false;
      signInForm.dispatchEvent(new CustomEvent("barazaLeaderSignInStarted"));
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/baraza-leader-auth`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "login", fullName, accessCode: grNumber }),
        });

        if (response.status === 401) {
          status.textContent = "Invalid name or access code. Please try again.";
          grInput.setAttribute("aria-invalid", "true");
          return;
        }
        if (!response.ok) {
          console.error(`Baraza sign-in endpoint returned HTTP ${response.status}.`);
          status.textContent = "Baraza sign-in is temporarily unavailable. Please try again.";
          return;
        }

        const result = await response.json();
        if (typeof result.token !== "string"
          || !Number.isInteger(result.barazaId)
          || result.barazaId < 1
          || result.barazaId > 17) {
          console.error("Baraza sign-in endpoint returned an invalid session response.");
          status.textContent = "Baraza sign-in is temporarily unavailable. Please try again.";
          return;
        }

        window.sessionStorage.setItem(gradeAccessTokenKey, result.token);
        signInForm.dispatchEvent(new CustomEvent("barazaLeaderSignInReady"));
        signInSucceeded = true;
      } catch (error) {
        console.error("Unable to reach the Baraza sign-in service.", error);
        status.textContent = "Baraza sign-in is temporarily unavailable. Please try again.";
      } finally {
        if (!signInSucceeded) {
          signInForm.dispatchEvent(new CustomEvent("barazaLeaderSignInFailed"));
        }
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
      return;
    }

    const nameIsValid = fullName.length <= 80
      && /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u.test(fullName);
    const fields = [
      {
        input: nameInput,
        error: nameError,
        message: "Please enter your full name using letters, spaces, apostrophes or hyphens.",
        isValid: nameIsValid,
      },
      {
        input: grInput,
        error: grError,
        message: "Please enter a GR number with up to 5 digits.",
        isValid: /^[0-9]{1,5}$/.test(grNumber),
      },
    ];
    let hasError = false;

    fields.forEach(({ input, error, message, isValid }) => {
      if (!input.value.trim() || !isValid) {
        error.textContent = message;
        input.setAttribute("aria-invalid", "true");
        hasError = true;
      }
    });

    if (hasError) {
      status.textContent = "Complete the required fields to continue.";
      return;
    }

    if (fullName === "adminihs" && grNumber === "20260") {
      signInForm.dispatchEvent(new CustomEvent("signInDetailsReady"));
      return;
    }
    gradeModal?.classList.add("is-open");
    gradeModal?.setAttribute("aria-hidden", "false");
  });

  gradeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      selectedGradeGroup = option.dataset.gradeGroup;
      gradeOptions.forEach((gradeOption) => {
        const isSelected = gradeOption === option;
        gradeOption.classList.toggle("is-selected", isSelected);
        gradeOption.setAttribute("aria-pressed", String(isSelected));
      });
      if (gradeContinueButton) gradeContinueButton.disabled = false;
      if (gradeStatus) gradeStatus.textContent = "";
    });
  });

  gradeContinueButton?.addEventListener("click", () => {
    if (!selectedGradeGroup) {
      if (gradeStatus) gradeStatus.textContent = "Choose your grade group to continue.";
      return;
    }
    window.localStorage.setItem("roundsquare-grade-group", selectedGradeGroup);
    gradeModal?.classList.remove("is-open");
    gradeModal?.setAttribute("aria-hidden", "true");
    signInForm.dispatchEvent(new CustomEvent("signInDetailsReady"));
  });
}
