const FUNCTION_URL = "REPLACE_WITH_LAMBDA_FUNCTION_URL";
const form = document.querySelector("#study-form");
const textInput = document.querySelector("#source-text");
const count = document.querySelector("#character-count");
const documentInput = document.querySelector("#document-input");
const fileStatus = document.querySelector("#file-status");
const button = document.querySelector("#submit-button");
const results = document.querySelector("#results-panel");
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 20000;

if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
setTheme(localStorage.getItem("study-signal-theme") || "dark");
themeToggle.addEventListener("click", () => setTheme(document.body.dataset.theme === "dark" ? "light" : "dark"));

textInput.addEventListener("input", () => {
  updateCharacterCount();
});

documentInput.addEventListener("change", async () => {
  const file = documentInput.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    fileStatus.textContent = "That file is over the 2 MB limit.";
    fileStatus.classList.add("file-error");
    documentInput.value = "";
    return;
  }
  try {
    const text = await extractText(file);
    textInput.value = text.slice(0, MAX_TEXT_CHARACTERS);
    updateCharacterCount();
    fileStatus.textContent = text.length > MAX_TEXT_CHARACTERS ? `${file.name} loaded and trimmed to 20,000 characters` : `${file.name} loaded`;
    fileStatus.classList.remove("file-error");
  } catch {
    fileStatus.textContent = "This document could not be read in the browser.";
    fileStatus.classList.add("file-error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = textInput.value.trim();
  if (!text || FUNCTION_URL.startsWith("REPLACE_")) {
    showError(FUNCTION_URL.startsWith("REPLACE_") ? "Add your Lambda Function URL in app.js before submitting." : "Paste some source material first.");
    return;
  }

  button.disabled = true;
  button.querySelector("span").textContent = "Thinking...";
  results.innerHTML = '<div class="empty-state"><span class="empty-number">02</span><h2>Reading between<br />the lines...</h2><p>This usually takes a few seconds.</p></div>';

  try {
    const response = await fetch(FUNCTION_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The assistant could not process that request.");
    renderResults(payload.analysis || payload);
  } catch (error) {
    showError(error.message || "Something went wrong. Check the Function URL and try again.");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Build study guide";
  }
});

function renderResults(analysis) {
  const thesis = analysis.core_thesis || analysis.core_concept || analysis.thesis || "No core thesis returned.";
  const takeaways = toArray(analysis.key_technical_takeaways || analysis.technical_takeaways || analysis.takeaways);
  const questions = toArray(analysis.study_questions || analysis.review_questions || analysis.questions);
  results.innerHTML = `<div class="result-content"><span class="panel-kicker">02 / Distilled notes</span><h2>Here is the signal.</h2><section class="result-block"><h3>Core thesis / concept</h3><p>${escapeHtml(thesis)}</p></section><section class="result-block"><h3>Key technical takeaways</h3><ul>${takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section><section class="result-block"><h3>Quick study questions</h3><ol class="question-list">${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section></div>`;
}

function toArray(value) { return Array.isArray(value) ? value : value ? [value] : ["No items returned."]; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function showError(message) { results.innerHTML = `<div class="error-message"><h2>Could not build the guide.</h2><p>${escapeHtml(message)}</p></div>`; }
function updateCharacterCount() { count.textContent = `${textInput.value.length.toLocaleString()} / ${MAX_TEXT_CHARACTERS.toLocaleString()}`; }
function setTheme(theme) { document.body.dataset.theme = theme; themeIcon.innerHTML = theme === "dark" ? "&#9788;" : "&#9790;"; themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`); localStorage.setItem("study-signal-theme", theme); }

async function extractText(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (["txt", "md", "csv", "json"].includes(extension)) return file.text();
  if (extension === "docx") {
    if (!window.mammoth) throw new Error("Word document support could not be loaded. Check your connection and try again.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("PDF support could not be loaded. Check your connection and try again.");
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n");
  }
  throw new Error("Use a TXT, MD, CSV, JSON, DOCX, or PDF file.");
}