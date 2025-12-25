console.log("Background script loaded");

/* global chrome */
const CLIENT_ID = "Ov23liAQQQpfH1gP98nn";
const CLIENT_SECRET = "8b0c9ca15cb272a8e6ddbfd8e286c50b6c2f9218";

// --- 1. AUTHENTICATION FLOW ---
async function startAuth() {
  console.log("[AUTH] Starting GitHub authentication...");

  const redirectURL = chrome.identity.getRedirectURL();
  console.log("[AUTH] Redirect URL:", redirectURL);

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirectURL)}`;
  console.log("[AUTH] Launching auth URL:", authUrl);

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
    if (chrome.runtime.lastError || !responseUrl) {
      console.error('[AUTH] Auth failed:', chrome.runtime.lastError?.message || 'No response URL');
      return;
    }

    console.log("[AUTH] Received redirect URL:", responseUrl);

    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) {
      console.error('[AUTH] No authorization code found in redirect URL');
      return;
    }

    console.log("[AUTH] Authorization code received:", code.substring(0, 10) + "...");

    try {
      console.log("[AUTH] Exchanging code for token...");
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          redirect_uri: redirectURL
        })
      });

      const data = await tokenResponse.json();
      console.log("[AUTH] Token exchange response:", data);

      if (data.error) {
        console.error('[AUTH] Token exchange error:', data.error_description || data.error);
        return;
      }

      const token = data.access_token;

      if (!token) {
        console.error('[AUTH] No access token received');
        return;
      }

      console.log("[AUTH] Access token received (length):", token.length);

      // Get user info
      console.log("[AUTH] Fetching GitHub user info...");
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json();
      console.log("[AUTH] GitHub user:", userData.login, userData.email || '(no email)');

      await chrome.storage.sync.set({
        ghToken: token,
        ghUsername: userData.login,
        ghEmail: userData.email || `${userData.login}@users.noreply.github.com`
      });

      console.log("GitHub authentication successful! Saved token and username.");
    } catch (err) {
      console.error('[AUTH] Unexpected error during auth:', err);
    }
  });
}

// --- 2. HELPER: CREATE REPO IF NOT EXISTS ---
async function createRepoIfNotExists(token, repoFullName) {
  console.log(`[REPO] Checking if repo exists: ${repoFullName}`);

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  const [owner, repoName] = repoFullName.split('/');

  try {
    const repoCheckRes = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
    if (repoCheckRes.ok) {
      console.log(`[REPO] Repository ${repoFullName} already exists.`);
      return;
    }

    if (repoCheckRes.status !== 404) {
      throw new Error(`Unexpected status ${repoCheckRes.status} when checking repo`);
    }

    console.log(`[REPO] Repo not found. Creating new repo: ${repoName}`);

    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        description: 'Automated backup of Codeforces solutions',
        private: false,
        auto_init: true
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      console.error("[REPO] Failed to create repo:", err);
      throw new Error(err.message || `Failed to create repo: ${createRes.status}`);
    }

    console.log(`[REPO] Successfully created repository ${repoFullName}`);
  } catch (err) {
    console.error('[REPO] Error in createRepoIfNotExists:', err);
    throw err;
  }
}

// --- 3. GITHUB PUSH LOGIC ---
async function uploadFilesToGitHub(token, repoFullName, contestId, problemNo, files, commitMessage, problemName) {
  console.log(`[PUSH] Starting push to ${repoFullName}`);
  console.log(`[PUSH] Contest: ${contestId}, Problem: ${problemNo}`);
  console.log(`[PUSH] Files:`, files.map(f => f.fileName).join(', '));
  console.log(`[PUSH] Commit message: ${commitMessage}`);

  const basePath = `${contestId}/${problemNo} - ${problemName}/`;
  console.log(`[PUSH] Target folder path: ${basePath}`);

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  // Ensure repo exists
  await createRepoIfNotExists(token, repoFullName);

  // Get current branch head
  console.log("[PUSH] Fetching main branch info...");
  const branchRes = await fetch(`https://api.github.com/repos/${repoFullName}/branches/main`, { headers });
  if (!branchRes.ok) {
    const err = await branchRes.json().catch(() => ({}));
    console.error("[PUSH] Failed to get branch:", err);
    throw new Error(err.message || `Failed to get branch: ${branchRes.status}`);
  }
  const branch = await branchRes.json();
  const headCommitSha = branch.commit.sha;
  const baseTreeSha = branch.commit.commit.tree.sha;
  console.log("[PUSH] Current head SHA:", headCommitSha.substring(0, 7));
  console.log("[PUSH] Base tree SHA:", baseTreeSha.substring(0, 7));

  // Prepare tree entries
  const treeEntries = files.map(file => ({
    path: `${basePath}${file.fileName}`,
    mode: '100644',
    type: 'blob',
    content: file.content
  }));
  console.log("[PUSH] Tree entries prepared:", treeEntries.map(e => e.path));

  // Create new tree
  console.log("[PUSH] Creating new Git tree...");
  const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries
    })
  });
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    console.error("[PUSH] Tree creation failed:", err);
    throw new Error(err.message || `Failed to create tree: ${treeRes.status}`);
  }
  const newTree = await treeRes.json();
  console.log("[PUSH] New tree SHA:", newTree.sha.substring(0, 7));

  // Create commit
  console.log("[PUSH] Creating new commit...");
  const commitRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      parents: [headCommitSha],
      tree: newTree.sha
    })
  });
  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({}));
    console.error("[PUSH] Commit creation failed:", err);
    throw new Error(err.message || `Failed to create commit: ${commitRes.status}`);
  }
  const newCommit = await commitRes.json();
  console.log("[PUSH] New commit SHA:", newCommit.sha.substring(0, 7));

  // Update reference
  console.log("[PUSH] Updating main branch reference...");
  const refRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!refRes.ok) {
    const err = await refRes.json().catch(() => ({}));
    console.error("[PUSH] Failed to update ref:", err);
    throw new Error(err.message || `Failed to update ref: ${refRes.status}`);
  }

  console.log(`[PUSH] Successfully committed files to ${basePath} in ${repoFullName}`);
  return await refRes.json();
}

// --- 4. MESSAGE HANDLER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[MESSAGE] Received message:", request.action);

  if (request.action === 'startAuth') {
    console.log("[MESSAGE] Starting auth flow...");
    startAuth();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "PUSH_TO_GITHUB") {
    console.log("[MESSAGE] PUSH_TO_GITHUB request received");

    const { token, repo, contestId, problemNo, files, message, problemName } = request.data;
    console.log("[MESSAGE] Push data:", { repo, contestId, problemNo, fileCount: files.length });

    uploadFilesToGitHub(token, repo, contestId, problemNo, files, message, problemName)
      .then(() => {
        console.log("[PUSH] Push completed successfully");
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "GITHUB_PUSH_SUCCESS",
          problemName: request.data.problemName
        });
      })
      .catch((error) => {
        console.error("[PUSH] Push failed:", error.message);
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "GITHUB_PUSH_FAILED",
          error: error.message
        });
      });

    return true;
  }

  return false;
});


// script starts here
console.log("CFPusher background service worker loaded");

const pendingSubmissions = new Map();

// Listener 1: Capture the submitted code before the POST request
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST" || !details.requestBody?.formData) {
      return;
    }

    const formData = details.requestBody.formData;
    const code = formData.sourceCode?.[0] || formData.source?.[0];

    if (code) {
      pendingSubmissions.set(details.requestId, {
        code,
        problemId: formData.submittedProblemIndex?.[0] || formData.problemIndex?.[0],
      });
      console.log("Captured submission:", details.requestId, "Problem ID:", pendingSubmissions.get(details.requestId).problemId);
    }
  },
  {
    urls: [
      "*://codeforces.com/problemset/submit*",
      "*://codeforces.com/contest/*/submit*"
    ]
  },
  ["requestBody"]
);

// Listener 2: Detect redirect after successful submission
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const requestId = details.requestId;
    const submission = pendingSubmissions.get(requestId);

    if (!submission) return;

    const isRedirect = details.statusCode >= 300 && details.statusCode < 400;
    console.log("Headers received:", details.statusCode, isRedirect ? "(redirect)" : "");

    if (isRedirect) {
      console.log("Redirect detected → Starting verdict watchdog");
      startWatchdog(details.tabId, submission);
    }

    // Clean up
    pendingSubmissions.delete(requestId);
  },
  {
    urls: [
      "*://codeforces.com/problemset/submit*",
      "*://codeforces.com/contest/*/submit*"
    ]
  },
  ["responseHeaders"]
);

// Watchdog: Poll Codeforces API for verdict
async function startWatchdog(tabId, subData) {
  const storage = await chrome.storage.sync.get(["codeforcesUsername", "githubRepo"]);
  const handle = storage.codeforcesUsername || "Hacker_bot"; // fallback if not set

  chrome.tabs.sendMessage(tabId, { action: "UPDATE_STATUS", msg: "Waiting for verdict..." });

  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`);
      const data = await response.json();

      if (data.status !== "OK" || data.result.length === 0) {
        return;
      }

      const latest = data.result[0];

      // Still testing → keep polling
      if (latest.verdict === "TESTING") {
        return;
      }

      // Verdict is final → stop polling
      clearInterval(pollInterval);

      if (latest.verdict === "OK") {
        console.log(latest);
        const problemUrl = `https://codeforces.com/contest/${latest.contestId}/problem/${latest.problem.index}`;
        const pageResp = await fetch(problemUrl);
        const html = await pageResp.text();
        console.log(html);

        const syncData = await chrome.storage.sync.get(["ghToken", "ghUsername", "githubRepo"]);

        chrome.tabs.sendMessage(tabId, {
        action: "SYNC_READY",
        code: subData.code,
        problemHtml: html,
        problemName: latest.problem.name,
        contestId: latest.contestId,
        problemNo: latest.problem.index,
        language: latest.programmingLanguage,
        // --- PERFORMANCE METRICS ---
        performance: {
            time: latest.timeConsumedMillis,
            memory: latest.memoryConsumedBytes,
            testCases: latest.passedTestCount,
            submissionId: latest.id,
            rating: latest.problem.rating || "Unrated"
        },
        syncData,
        });
      }
    } catch (err) {
      console.error("Watchdog error:", err);
      clearInterval(pollInterval);
      chrome.tabs.sendMessage(tabId, {
        action: "SYNC_FAILED",
        reason: "Network or API error",
      });
    }
  }, 3000); // Poll every 3 seconds
}