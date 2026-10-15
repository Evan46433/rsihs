import { supabase } from "./supabase-client.js";

const adminSessionKey = "roundsquare-admin-authorized";

if (window.sessionStorage.getItem(adminSessionKey) !== "true") {
  window.location.replace("signin.html");
}

const messageForm = document.querySelector(".admin-message-form");
const formStatus = document.querySelector(".form-status");
const signOutButton = document.querySelector(".sign-out");
const messageList = document.querySelector(".admin-message-list");
const clearMessagesButton = document.querySelector(".clear-messages");

const getMessages = async () => {
  const { data, error } = await supabase
    .from("admin_messages")
    .select("id, title, message, content, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

const renderMessages = async () => {
  if (!messageList) return;
  let messages;
  try {
    messages = await getMessages();
  } catch (error) {
    messageList.innerHTML = '<p class="admin-message-empty">Messages could not be loaded. Run the Supabase setup SQL first.</p>';
    console.error("Unable to load admin messages.", error);
    return;
  }
  if (!messages.length) {
    messageList.innerHTML = '<p class="admin-message-empty">No messages sent yet.</p>';
    return;
  }
  messageList.replaceChildren(...messages.map((item) => {
    const card = document.createElement("article");
    card.className = "admin-message-item";
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const message = document.createElement("p");
    message.textContent = item.message || item.content;
    const time = document.createElement("time");
    time.textContent = new Date(item.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    content.append(title, message, time);
    const removeButton = document.createElement("button");
    removeButton.className = "remove-message";
    removeButton.type = "button";
    removeButton.textContent = "REMOVE";
    removeButton.addEventListener("click", async () => {
      const { error } = await supabase.from("admin_messages").delete().eq("id", item.id);
      if (error) {
        formStatus.textContent = "The message could not be removed.";
        console.error("Unable to remove admin message.", error);
        return;
      }
      renderMessages();
    });
    card.append(content, removeButton);
    return card;
  }));
};

messageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(messageForm);
  const title = String(formData.get("title") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!title || !message) return;

  const { error } = await supabase.from("admin_messages").insert({ title, message, content: message });
  if (error) {
    formStatus.textContent = "The message could not be sent. Run the Supabase setup SQL first.";
    console.error("Unable to send admin message.", error);
    return;
  }
  messageForm.reset();
  formStatus.textContent = "Message sent to student dashboards.";
  renderMessages();
});

clearMessagesButton?.addEventListener("click", async () => {
  const { error } = await supabase.from("admin_messages").delete().not("id", "is", null);
  if (error) {
    formStatus.textContent = "Messages could not be removed.";
    console.error("Unable to remove admin messages.", error);
    return;
  }
  renderMessages();
  formStatus.textContent = "All messages were removed from student dashboards.";
});

renderMessages();

supabase
  .channel("admin-message-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "admin_messages" }, () => renderMessages())
  .subscribe();

signOutButton?.addEventListener("click", () => {
  window.sessionStorage.removeItem(adminSessionKey);
  window.location.replace("index.html");
});
