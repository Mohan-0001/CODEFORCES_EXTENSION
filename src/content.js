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
        
        // --- NEW: Extract Tags ---
        const tagElements = doc.querySelectorAll(".tag-box");
        const tags = Array.from(tagElements).map(el => el.innerText.trim());
        // -------------------------

        const rawElement = doc.querySelector(".problem-statement");
        
        // Pass tags to the README generator
        const readmeContent = generateProfessionalReadme(rawElement, message.problemName, message.performance, tags);

        const originalCode = message.code;
        const langToExt = {
            'GNU C++11': 'cpp', 'GNU C++14': 'cpp', 'GNU C++17': 'cpp', 'GNU C++20': 'cpp',
            'Java 8': 'java', 'Java 11': 'java', 'Java 17': 'java',
            'Python 3': 'py', 'PyPy 3': 'py',
        };
        const ext = langToExt[message.language] || 'txt';
        const solutionFileName = `Solution.${ext}`;

        const { ghToken, githubRepo } = message.syncData;
        const memoryKB = (message.performance.memory / 1024).toFixed(0);
        const performanceCommitMsg = `Solved ${message.problemName} | Time: ${message.performance.time}ms | Memory: ${memoryKB}KB | Tags: ${tags.join(', ')}`;

        try {
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
                    message: performanceCommitMsg,
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
});

/**
 * Transforms Codeforces HTML into a LeetCode-style README
 */
function generateProfessionalReadme(container, problemName, perf, tags) {
    if (!container) return `# ${problemName}\n\nNo statement found.`;

    const cleanSectionText = (node, titleToRemove = "") => {
        if (!node) return "";
        node.querySelectorAll('.MJX_Assistive_MathML, script, .MathJax_Preview').forEach(el => el.remove());
        
        let text = node.innerText;
        text = text.replace(/\$\$\$/g, '$')
                   .replace(/\\dots/g, '...')
                   .replace(/\\le/g, '≤')
                   .replace(/\\ge/g, '≥');

        if (titleToRemove) {
            const regex = new RegExp(`^${titleToRemove}`, 'i');
            text = text.trim().replace(regex, '').trim();
        }
        return text.trim();
    };

    const timeLimit = container.querySelector('.time-limit')?.innerText.replace('time limit per test', '').trim() || "2 seconds";
    const memoryLimit = container.querySelector('.memory-limit')?.innerText.replace('memory limit per test', '').trim() || "256 megabytes";
    
    const description = cleanSectionText(container.querySelector('.header + div'));
    const inputSpec = cleanSectionText(container.querySelector('.input-specification'), "Input");
    const outputSpec = cleanSectionText(container.querySelector('.output-specification'), "Output");
    
    const sampleInput = (container.querySelector('.sample-test .input pre')?.innerText || "").replace(/\$\$\$/g, '$').trim();
    const sampleOutput = (container.querySelector('.sample-test .output pre')?.innerText || "").replace(/\$\$\$/g, '$').trim();
    const note = cleanSectionText(container.querySelector('.note'), "Note");

    // Create Badge HTML for tags (Professional Blue Theme)
    const tagBadges = tags.map(tag => 
        `<img src="https://img.shields.io/badge/-${tag.replace(/-/g, '%20')}-4B5563?style=flat-square" />`
    ).join(' ');

    return `# ${problemName}

${tagBadges}

<div align="center">
  <strong>Time Limit:</strong> ${timeLimit} | <strong>Memory Limit:</strong> ${memoryLimit}
</div>

---

### Problem Statement
${description}

### Input Specification
${inputSpec}

### Output Specification
${outputSpec}

---

### Example
**Input:**
\`\`\`text
${sampleInput}
\`\`\`

**Output:**
\`\`\`text
${sampleOutput}
\`\`\`

${note ? `### Explanation\n${note}\n` : ''}

---
### Submission Info
* **Time:** ${perf.time} ms
* **Memory:** ${(perf.memory / 1024).toFixed(0)} KB
* **Difficulty:** ${perf.rating}
* **Verdict:** AC

*Generated by Code-To-Git Sync Tool*`;
}

function getOrCreateBox() {
    let box = document.getElementById("cf-sync-box");
    if (!box) {
        box = document.createElement("div");
        box.id = "cf-sync-box";
        box.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:10000; padding:15px; background:#1e1e1e; color:white; border-radius:8px; border-left:5px solid #2ecc71; font-family:sans-serif; box-shadow:0 4px 15px rgba(0,0,0,0.3); max-width:300px;";
        document.body.appendChild(box);
    }
    return box;
}