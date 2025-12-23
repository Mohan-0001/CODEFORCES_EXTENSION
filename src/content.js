chrome.runtime.onMessage.addListener(async (message) => {
  let box = getOrCreateBox();

  if (message.action === "UPDATE_STATUS") {
    box.innerHTML = `<strong>CF Sync:</strong> ${message.msg}`;
  }
  else if (message.action === "SYNC_READY") {
    box.style.borderColor = "#2ecc71";
    box.innerHTML = `<strong>✅ Verdict OK!</strong><br>Cleaning & Pushing...`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(message.problemHtml, "text/html");
    const rawElement = doc.querySelector(".problem-statement");
    const cleanStatement = cleanStatementText(rawElement);
    const originalCode = message.code;

    const readmeContent = `# ${message.problemName}\n\n${cleanStatement}`;

    // Determine solution file extension based on language
    const langToExt = {
      'GNU C++11': 'cpp',
      'GNU C++14': 'cpp',
      'GNU C++17': 'cpp',
      'GNU C++20': 'cpp',
      'Java 8': 'java',
      'Java 11': 'java',
      'Java 17': 'java',
      'Python 3': 'py',
      'PyPy 3': 'py',
      // Add more mappings as needed for supported languages
    };
    const ext = langToExt[message.language] || 'txt';
    const solutionFileName = `Solution.${ext}`;

    const { ghToken, githubRepo, ghUsername } = message.syncData;

    try {
      // Push both files in a single commit
      await chrome.runtime.sendMessage({
        action: "PUSH_TO_GITHUB",
        data: {
          token: ghToken,
          repo: githubRepo,
          contestId: message.contestId,
          problemNo: message.problemNo,
          files: [
            { fileName: 'README.md', content: readmeContent },
            { fileName: solutionFileName, content: originalCode }
          ],
          message: `Add/Update solution for ${message.problemName} (${message.contestId}${message.problemNo})`,
          problemName: message.problemName
        }
      });

      box.innerHTML = `<strong>🚀 Synced!</strong><br>${message.problemName}<br>README.md + ${solutionFileName} pushed.`;
    } catch (err) {
      box.style.borderColor = "#e74c3c";
      box.innerHTML = `<strong>❌ Push failed</strong><br>${err.message || 'Unknown error'}`;
    }

    setTimeout(() => box.remove(), 6000);
  }
  else if (message.action === "SYNC_FAILED") {
    box.style.borderColor = "#e74c3c";
    box.innerHTML = `<strong>❌ Verdict: ${message.reason}</strong><br>Sync cancelled.`;
    setTimeout(() => box.remove(), 5000);
  }
  else if (message.action === "GITHUB_PUSH_SUCCESS") {
    // Optional: extra success handling
  }
  else if (message.action === "GITHUB_PUSH_FAILED") {
    box.style.borderColor = "#e74c3c";
    box.innerHTML = `<strong>❌ GitHub Error</strong><br>${message.error}`;
    setTimeout(() => box.remove(), 8000);
  }
});

function cleanStatementText(element) {
  if (!element) return "No statement found";
  return element.innerText
    .replace(/\$\$\$/g, '')
    .replace(/\\dots/g, '...')
    .replace(/\\le/g, '<=')
    .replace(/\\ge/g, '>=')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/Copy/g, '')
    .trim();
}

function getOrCreateBox() {
  let box = document.getElementById("cf-sync-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "cf-sync-box";
    box.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:10000; padding:15px; background:#1e1e1e; color:white; border-radius:8px; border-left:5px solid #f1c40f; font-family:sans-serif; box-shadow:0 4px 15px rgba(0,0,0,0.3); max-width:300px;";
    document.body.appendChild(box);
  }
  return box;
}