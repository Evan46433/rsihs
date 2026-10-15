import { barazaRecords } from "./baraza-data.js";
import { initializeDiscussionPlanner } from "./discussion-planner.js";
import { supabaseAnonKey, supabaseUrl } from "./supabase-config.js";

const leaderSessionKey = "roundsquare-baraza-leader-session";

const showDashboardError = (message) => {
  const status = document.querySelector("[data-leader-dashboard-status]");
  const statusMessage = document.querySelector("[data-leader-dashboard-status-message]");
  if (!status || !statusMessage) {
    console.error("The Baraza dashboard status message is missing.");
    return;
  }
  statusMessage.textContent = message;
  status.hidden = false;
};

const verifyLeaderSession = async (token) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/baraza-leader-auth`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action: "session", token }),
  });
  if (response.status === 401) return { expired: true };
  if (!response.ok) {
    console.error(`Baraza session endpoint returned HTTP ${response.status}.`);
    return { unavailable: true };
  }

  const result = await response.json();
  if (!Number.isInteger(result.barazaId) || result.barazaId < 1 || result.barazaId > 17) {
    console.error("Baraza session endpoint returned an invalid profile response.");
    return { unavailable: true };
  }
  return { barazaId: result.barazaId };
};

const renderLeaderDashboard = (record) => {
  const profileView = document.querySelector(".baraza-profile-view");
  if (!profileView) {
    console.error("The Baraza leader profile view is missing.");
    showDashboardError("The dashboard could not be loaded. Please sign in again.");
    return;
  }

  document.body.classList.add("is-baraza-leader");
  profileView.hidden = false;
  profileView.dataset.ribbon = record.ribbon?.toLowerCase().replaceAll(" ", "-") || "none";
  profileView.querySelector(".view-back-button").hidden = true;
  profileView.querySelector(".view-heading .eyebrow").textContent = "Your Baraza dashboard";
  const welcome = profileView.querySelector("[data-leader-welcome]");
  welcome.textContent = `Welcome, ${record.head}`;
  welcome.hidden = false;
  profileView.querySelector("#profile-title").textContent = record.happiness;
  profileView.querySelector("#profile-language").textContent = record.language;
  profileView.querySelector("#profile-level").textContent = record.level;
  profileView.querySelector("#profile-head").textContent = record.head;

  const ribbon = profileView.querySelector("#profile-ribbon");
  ribbon.hidden = !record.ribbon;
  if (record.ribbon) {
    ribbon.dataset.ribbon = record.ribbon.toLowerCase().replaceAll(" ", "-");
    profileView.querySelector("#profile-ribbon-name").textContent = record.ribbon;
  } else {
    delete ribbon.dataset.ribbon;
  }

  [record.coLeaders[0], record.coLeaders[1]].forEach((name, index) => {
    const leader = profileView.querySelector(`#profile-co-${index === 0 ? "one" : "two"}`);
    leader.textContent = name || "";
    leader.parentElement.hidden = !name;
  });
};

export const initializeBarazaLeaderDashboard = async () => {
  document.body.classList.add("is-baraza-leader");
  const token = window.sessionStorage.getItem(leaderSessionKey);
  if (!token) {
    window.location.replace("signin.html");
    return;
  }

  try {
    const session = await verifyLeaderSession(token);
    if (session.expired) {
      window.sessionStorage.removeItem(leaderSessionKey);
      window.location.replace("signin.html");
      return;
    }
    if (session.unavailable) {
      showDashboardError("We couldn't verify your access right now. Please try again.");
      return;
    }

    const record = barazaRecords.find(({ id }) => id === session.barazaId);
    if (!record) {
      console.error(`No published Baraza profile exists for authenticated record ${session.barazaId}.`);
      showDashboardError("Your Baraza profile could not be found. Please contact an organiser.");
      return;
    }

    renderLeaderDashboard(record);
    initializeDiscussionPlanner(record);
    document.querySelector(".leader-signout-link")?.addEventListener("click", () => {
      window.sessionStorage.removeItem(leaderSessionKey);
    });
  } catch (error) {
    console.error("Unable to verify the Baraza dashboard session.", error);
    showDashboardError("We couldn't verify your access right now. Please try again.");
  }
};
