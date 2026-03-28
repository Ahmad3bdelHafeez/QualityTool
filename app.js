// app.js

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    lucide.createIcons();
});

// --- Execution Tab Switching ---
function switchExecTab(btn, panelId) {
    // Deactivate all tabs and panels in the execution module
    document.querySelectorAll('.exec-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.exec-tab-panel').forEach(p => p.classList.add('hidden'));
    // Activate selected
    btn.classList.add('active');
    const panel = document.getElementById(panelId);
    if (panel) { panel.classList.remove('hidden'); panel.classList.add('active'); }
}

// --- Fill Bug Report from Failed Executions ---
function fillBugFromFailed() {
    const failedRows = [];
    document.querySelectorAll('#exec-output tbody tr').forEach(tr => {
        if (!tr.querySelector('.status-toggle button.active-fail')) return;

        // TC ID from button data-tcid
        const statusBtn = tr.querySelector('.status-toggle button[data-tcid]');
        const tcId = statusBtn ? statusBtn.dataset.tcid : '';

        // Title — first bold div inside the details cell
        const titleEl = tr.querySelector('td:nth-child(2) div[style*="font-weight:600"]');
        const title = titleEl ? titleEl.innerText.trim() : '';

        // Steps & Expected — text after "Steps" label
        const stepDivs = tr.querySelectorAll('td:nth-child(2) div[style*="white-space:pre-wrap"]');
        let steps = stepDivs[0] ? stepDivs[0].innerText.trim() : '';

        // Expected Results — text in second pre-wrap div
        let expected = '';
        if (stepDivs[1]) expected = stepDivs[1].innerText.trim();

        // Actual Results textarea
        const actualEl = tr.querySelector('textarea');
        const actual = actualEl ? actualEl.value.trim() : '';

        failedRows.push({ tcId, title, steps, expected, actual });
    });

    if (failedRows.length === 0) {
        alert('No FAILED test cases found in the execution table.');
        return;
    }

    // Build notes string
    const notes = failedRows.map(r => {
        let block = `=== ${r.tcId} — ${r.title} ===`;
        if (r.steps) block += `\n\nSteps:\n${r.steps}`;
        if (r.expected) block += `\n\nExpected Behavior:\n${r.expected}`;
        if (r.actual) block += `\n\nActual Result:\n${r.actual}`;
        return block;
    }).join('\n\n' + '─'.repeat(50) + '\n\n');

    // Fill the first TC ID if only one failure
    const tcIdInput = document.getElementById('bug-tc-id');
    if (tcIdInput) {
        tcIdInput.value = failedRows.length === 1
            ? failedRows[0].tcId
            : failedRows.map(r => r.tcId).join(', ');
    }

    document.getElementById('bug-notes').value = notes;

    // Navigate to Bug Report module
    const bugLink = document.querySelector('.nav-links li[data-target="module-bugreport"]');
    if (bugLink) bugLink.click();
}



// --- Navigation Logic ---
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const modules = document.querySelectorAll('.module');
    const titleElement = document.getElementById('active-module-title');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update title
            titleElement.textContent = link.textContent;

            // Show target module
            const targetId = link.getAttribute('data-target');
            modules.forEach(m => {
                m.classList.remove('active');
                if (m.id === targetId) {
                    m.classList.add('active');
                }
            });
        });
    });
}

// --- Common UI Helpers ---
function showLoading(buttonId) {
    const btn = document.getElementById(buttonId);
    if(btn) {
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.spinner').classList.remove('hidden');
        btn.disabled = true;
    }
}

function hideLoading(buttonId) {
    const btn = document.getElementById(buttonId);
    if(btn) {
        btn.querySelector('.btn-text').style.display = 'inline-block';
        btn.querySelector('.spinner').classList.add('hidden');
        btn.disabled = false;
    }
}

function simulateAjax(callback, delay = 1000) {
    setTimeout(callback, delay);
}

// --- Markdown to HTML Table Parser ---
function parseMarkdownTableToHTML(markdown) {
    // Normalize all <br> tags to a placeholder so they survive line/cell splitting
    const normalized = markdown.replace(/<br\s*\/?>/gi, ' __BR__ ');

    const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l);

    // Collect pipe-lines; glue non-piped continuation lines onto last piped line
    const pipeLines = [];
    for (const line of rawLines) {
        if (line.startsWith('|')) {
            pipeLines.push(line);
        } else if (pipeLines.length > 0) {
            pipeLines[pipeLines.length - 1] =
                pipeLines[pipeLines.length - 1].replace(/\|(\s*)$/, '') + ' __BR__ ' + line + ' |';
        }
    }

    if (pipeLines.length < 2) return `<p class="placeholder-text">Could not parse table.</p><pre>${markdown}</pre>`;

    // Split a row using slice(1,-1) so inner empty cells keep their column position
    const splitRow = line => line.split('|').slice(1, -1).map(c => c.trim());

    const headers = splitRow(pipeLines[0]).filter(h => h !== '');
    let html = '<table><thead><tr>';
    headers.forEach(h => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';

    const dataRows = [];
    for (let i = 2; i < pipeLines.length; i++) {
        const line = pipeLines[i];
        if (/^[\s|\-:]+$/.test(line)) continue; // separator

        const cells = splitRow(line);
        if (cells.length === 0) continue;

        if (cells[0] === '' && dataRows.length > 0) {
            // Continuation row: first cell (TC ID) is empty → merge into previous row
            const prev = dataRows[dataRows.length - 1];
            cells.forEach((cell, idx) => {
                if (cell && idx < prev.length) {
                    prev[idx] = prev[idx] ? prev[idx] + ' __BR__ ' + cell : cell;
                }
            });
        } else {
            dataRows.push([...cells]);
        }
    }

    dataRows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            html += `<td contenteditable="true">${cell.replace(/__BR__/g, '<br>')}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}



// --- 1. Req Analysis ---
async function analyzeRequirements() {
    const input = document.getElementById('req-input').value;
    const output = document.getElementById('req-analyze-output');
    if (!input) { output.innerHTML = '<span style="color:var(--status-warning)">Please enter requirements first.</span>'; return; }
    
    output.innerHTML = 'Analyzing requirements...';
    try {
        const payload = { "user_story": input };
        const res = await fetch('https://api-mg.onrender.com/analyse-req', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        
        // Render: parse any markdown tables, otherwise display as formatted text
        let formattedContent = '';
        const lines = content.split('\n');
        let tableLines = [];
        
        lines.forEach(line => {
            if (line.trim().startsWith('|')) {
                tableLines.push(line);
            } else {
                if (tableLines.length > 0) {
                    formattedContent += `<div class="table-container" style="margin:1rem 0;">${parseMarkdownTableToHTML(tableLines.join('\n'))}</div>`;
                    tableLines = [];
                }
                if (line.trim()) {
                    formattedContent += `<p style="margin-bottom:0.5rem; color:var(--text-secondary);">${line}</p>`;
                }
            }
        });
        if (tableLines.length > 0) {
            formattedContent += `<div class="table-container" style="margin:1rem 0;">${parseMarkdownTableToHTML(tableLines.join('\n'))}</div>`;
        }
        if (!formattedContent) formattedContent = `<pre style="white-space:pre-wrap;">${content}</pre>`;
        
        output.innerHTML = `<strong>Requirements Analysis:</strong><div style="margin-top:1rem;">${formattedContent}</div>`;
        const analyzeExport = document.getElementById('req-analyze-export-buttons');
        if (analyzeExport) analyzeExport.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error analysing requirements: ${err.message}</span>`;
    }
}


async function generateScenarios() {
    const input = document.getElementById('req-input').value;
    const output = document.getElementById('req-output');
    if (!input) { output.innerHTML = '<span style="color:var(--status-warning)">Please enter requirements first.</span>'; return; }

    output.innerHTML = 'Generating Scenarios...';
    try {
        const payload = { "user_story": input };
        const res = await fetch('https://api-mg.onrender.com/generate-hls', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        
        let formattedContent = "";
        const lines = content.split('\n');
        let tableLines = [];
        let inTable = false;
        
        lines.forEach(line => {
            if (line.trim().startsWith('|')) {
                tableLines.push(line);
                inTable = true;
            } else {
                if (inTable && tableLines.length > 0) {
                    const filteredMarkdown = filterHLSColumns(tableLines.join('\n'));
                    formattedContent += `<div class="table-container" style="margin: 1rem 0;">${parseMarkdownTableToHTML(filteredMarkdown)}</div>`;
                    tableLines = [];
                    inTable = false;
                }
                if (line.trim()) {
                    formattedContent += `<p style="margin-bottom: 0.5rem; color: var(--text-secondary);">${line}</p>`;
                }
            }
        });
        if (tableLines.length > 0) {
            const filteredMarkdown = filterHLSColumns(tableLines.join('\n'));
            formattedContent += `<div class="table-container" style="margin: 1rem 0;">${parseMarkdownTableToHTML(filteredMarkdown)}</div>`;
        }
        
        output.innerHTML = `<strong>High-Level Scenarios:</strong><div style="margin-top: 1rem;">${formattedContent}</div>`;
        const exportBtns = document.getElementById('hls-export-buttons');
        if (exportBtns) exportBtns.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error generating scenarios: ${err.message}</span>`;
    }
}

// --- 2. Test Plan ---
async function generateTestPlan() {
    const scope = document.getElementById('tp-scope').value;
    const timeline = document.getElementById('tp-timeline').value;
    const resources = document.getElementById('tp-resources').value;
    const statusArea = document.getElementById('tp-status');
    const resultContainer = document.getElementById('tp-result-container');
    const downloadLink = document.getElementById('tp-download-link');
    
    statusArea.innerHTML = '<span class="status-dot connected"></span> Generating AI Test Plan... (Please wait)';
    resultContainer.classList.add('hidden');
    
    try {
        const payload = { "job_scope": `Scope: ${scope || 'Standard Web Scope'}, Timeline: ${timeline || 'Standard Sprint'}, Resources: ${resources || 'Standard QA Team'}` };
        const res = await fetch('https://api-mg.onrender.com/generate-test-plan', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || null;
        
        if (content && (content.startsWith('http') || content.includes('.csv') || content.includes('.pdf'))) {
            statusArea.innerHTML = '<span style="color:var(--status-success)">✓ Test Plan generated successfully! Click the button below to download.</span>';
            downloadLink.href = content;
            resultContainer.classList.remove('hidden');
        } else if (content) {
            // Success text fallback
            statusArea.innerHTML = `<span style="color:var(--status-success)">✓ Test Plan created.</span><br><br><div class="output-area document-layout" style="max-height:120px; font-size: 0.8em; overflow:auto;">${content.substring(0, 1000)}...</div>`;
            resultContainer.classList.remove('hidden');
        } else {
            statusArea.innerHTML = '<span style="color:var(--status-warning)">AI response received but no link or content found.</span>';
        }
    } catch(err) {
        statusArea.innerHTML = `<span style="color:var(--status-error)">Error generating test plan: ${err.message}</span>`;
    }
}

// --- 3. Core: Test Case Gen ---
let currentValidTestCases = "";

async function generateTestCases() {
    const story = document.getElementById('tc-story').value;
    const output = document.getElementById('tc-output');
    
    if (!story) {
        output.innerHTML = '<p class="placeholder-text" style="color:var(--status-warning)">Please enter a User Story.</p>';
        return;
    }

    showLoading('generate-tc-btn');
    output.innerHTML = 'Generating AI Test Cases...';
    
    try {
        const payload = { "user_story": story };
        const res = await fetch('https://api-mg.onrender.com/generate-test-cases', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const markdownList = data.output || data.response || "";
        
        let htmlTable = parseMarkdownTableToHTML(markdownList);
        output.innerHTML = htmlTable;
        currentValidTestCases = markdownList;
        populateExecutionTable(markdownList);
        
        const dqInput = document.getElementById('dq-test-cases');
        if (dqInput) dqInput.value = markdownList;
        
        const tcExportBtns = document.getElementById('tc-export-buttons');
        if (tcExportBtns) tcExportBtns.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error generating test cases: ${err.message}</span>`;
    } finally {
        hideLoading('generate-tc-btn');
    }
}

async function reviewTestCases() {
    const output = document.getElementById('tc-review-output');
    if (!currentValidTestCases) {
        output.classList.remove('hidden');
        output.innerHTML = '<span style="color:var(--status-warning)">Please generate test cases first.</span>';
        return;
    }

    showLoading('review-tc-btn');
    output.classList.remove('hidden');
    output.innerHTML = 'Reviewing Test Cases...';
    
    try {
        const payload = { "test_cases": currentValidTestCases };
        const res = await fetch('https://api-mg.onrender.com/review-test-cases', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        
        let formattedContent = "";
        const lines = content.split('\n');
        let tableLines = [];
        let inTable = false;
        
        lines.forEach(line => {
            if (line.trim().startsWith('|')) {
                tableLines.push(line);
                inTable = true;
            } else {
                if (inTable && tableLines.length > 0) {
                    formattedContent += `<div class="table-container" style="margin: 1rem 0;">${parseMarkdownTableToHTML(tableLines.join('\n'))}</div>`;
                    tableLines = [];
                    inTable = false;
                }
                if (line.trim()) {
                    formattedContent += `<p style="margin-bottom: 0.5rem; color: var(--text-secondary);">${line}</p>`;
                }
            }
        });
        if (tableLines.length > 0) {
            formattedContent += `<div class="table-container" style="margin: 1rem 0;">${parseMarkdownTableToHTML(tableLines.join('\n'))}</div>`;
        }
        
        if (!content.includes('|')) {
            formattedContent = `<pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>`;
        }
        
        output.innerHTML = `<strong>Test Case Review:</strong><br><br><div style="margin-top: 1rem;">${formattedContent}</div>`;
        const reviewExport = document.getElementById('tc-review-export-buttons');
        if (reviewExport) reviewExport.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error reviewing test cases: ${err.message}</span>`;
    } finally {
        hideLoading('review-tc-btn');
    }
}

async function generateDataQualityTests() {
    const output = document.getElementById('dq-review-output');
    const inputVal = document.getElementById('dq-test-cases').value;
    
    if (!inputVal) {
        output.classList.remove('hidden');
        output.innerHTML = '<span style="color:var(--status-warning)">Please provide generated test cases first.</span>';
        return;
    }

    showLoading('data-quality-btn');
    output.classList.remove('hidden');
    output.innerHTML = 'Generating Data Quality Tests...';
    
    try {
        const payload = { "test_cases": inputVal, "schema": "Please infer appropriate schema." };
        const url = 'https://api-mg.onrender.com/generate-data-quality-tests';
        const res = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        
        if (res.status === 404) {
            output.innerHTML = `<span style="color:var(--status-warning)">404 Not Found at generate-data-quality-tests. Falling back to Review endpoint as a mock demo...</span>`;
            const fallbackRes = await fetch('https://api-mg.onrender.com/review-test-cases', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const fallbackData = await fallbackRes.json();
            const content = fallbackData.output || fallbackData.response || JSON.stringify(fallbackData);
            output.innerHTML += `<br><br><pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>`;
            return;
        }

        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        output.innerHTML = `<strong>Data Quality Tests:</strong><br><br><pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>`;
        const dqExport = document.getElementById('dq-export-buttons');
        if (dqExport) dqExport.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error generating data quality tests: ${err.message}</span>`;
        const dqExport = document.getElementById('dq-export-buttons');
        if (dqExport) dqExport.classList.remove('hidden');
    } finally {
        hideLoading('data-quality-btn');
    }
}

// --- 4. Test Data ---
async function generateTestData() {
    const type = document.getElementById('td-type').value;
    const schema = document.getElementById('td-schema').value;
    const output = document.getElementById('td-output');
    
    output.innerHTML = 'Generating data...';
    try {
        const payload = { "input": `Format: ${type}, Context/Schema: ${schema}` };
        const res = await fetch('https://api-mg.onrender.com/generate-data', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        output.innerHTML = `<pre style="white-space: pre-wrap;"><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        const tdExport = document.getElementById('td-export-buttons');
        if (tdExport) tdExport.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error generating data: ${err.message}</span>`;
    }
}

// --- 5. Execution & RTM ---
function populateExecutionTable(markdown) {
    const execOutput = document.getElementById('exec-output');
    const rtmOutput = document.getElementById('rtm-output');
    
    const lines = markdown.trim().split('\n');
    const tableLines = lines.filter(line => line.includes('|'));
    
    if (tableLines.length < 3) return;

    // Parse headers to find correct column indices
    const headerCols = tableLines[0].split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx===0&&c==='') && !(idx===arr.length-1&&c===''));
    
    let tcIdIdx = 0, titleIdx = 1, stepsIdx = -1, expectIdx = -1;
    headerCols.forEach((h, i) => {
        const low = h.toLowerCase();
        if (low.includes('test case id') || low === 'id') tcIdIdx = i;
        else if (low.includes('title') || low.includes('name') || (low.includes('test case') && !low.includes('id'))) titleIdx = i;
        else if (low.includes('step') || low.includes('flow')) stepsIdx = i;
        else if (low.includes('expect')) expectIdx = i;
    });

    // Execution Table
    let execHtml = `<table style="table-layout:fixed; width:100%;"><thead><tr>
        <th style="width:90px;">TC ID</th>
        <th>Test Case Details</th>
        <th style="width:150px;">Execution Status</th>
    </tr></thead><tbody>`;

    // RTM Table
    let rtmHtml = `<table><thead><tr>
        <th>Requirement ID</th><th>TC ID</th><th>Execution Status</th>
    </tr></thead><tbody>`;

    // Determine User Story ID for RTM
    let storyId = "Story";
    const jiraInputTc = document.getElementById('jira-issue-id-tc');
    const jiraInputReq = document.getElementById('jira-issue-id');
    const storyText = document.getElementById('tc-story')?.value || "";
    
    if (jiraInputTc && jiraInputTc.value.trim()) {
        storyId = jiraInputTc.value.trim();
    } else if (jiraInputReq && jiraInputReq.value.trim()) {
        storyId = jiraInputReq.value.trim();
    } else {
        // Try to parse from text "User Story ID: KAN-123"
        const match = storyText.match(/User Story ID:\s*([A-Z0-9-]+)/i);
        if (match) storyId = match[1];
    }

    let counter = 1;
    for (let i = 2; i < tableLines.length; i++) {
        if (tableLines[i].replace(/[|-]/g,'').trim() === '') continue;
        const rawCols = tableLines[i].split('|').map(c => c.trim());
        const row = rawCols.filter((c, idx) => !(idx===0&&c==='') && !(idx===rawCols.length-1&&c===''));
        if (row.length < 2) continue;

        const tcId    = row[tcIdIdx]  || `TC-${counter}`;
        const title   = row[titleIdx] || 'Untitled Test Case';
        const steps   = stepsIdx  >= 0 && row[stepsIdx]  ? row[stepsIdx]  : '';
        const expects = expectIdx >= 0 && row[expectIdx] ? row[expectIdx] : '';
        const domId   = `exec-row-${counter}`;

        execHtml += `<tr>
            <td style="vertical-align:top; font-weight:600; color:var(--accent-light); padding-top:1rem; font-size:0.9em;">${tcId}</td>
            <td style="vertical-align:top; padding:0.75rem 0.5rem;">
                <div style="font-weight:600; color:var(--text-primary); margin-bottom:0.6rem;">${title}</div>
                ${steps ? `<div style="margin-bottom:0.75rem;">
                    <div style="font-size:0.75em; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent-light); margin-bottom:0.3rem;">Steps</div>
                    <div style="color:var(--text-secondary); font-size:0.875em; white-space:pre-wrap; border-left:2px solid var(--border-color); padding-left:0.75rem;">${steps}</div>
                </div>` : ''}
                ${expects ? `<div style="margin-bottom:0.75rem;">
                    <div style="font-size:0.75em; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent-light); margin-bottom:0.3rem;">Expected Results</div>
                    <div style="color:var(--text-secondary); font-size:0.875em; white-space:pre-wrap; border-left:2px solid var(--border-color); padding-left:0.75rem;">${expects}</div>
                </div>` : ''}
                <div>
                    <div style="font-size:0.75em; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent-light); margin-bottom:0.3rem;">Actual Results</div>
                    <textarea id="actual-${domId}" placeholder="Write actual results, observed behavior, errors..." style="display:block; width:100%; min-height:60px; box-sizing:border-box; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:6px; padding:0.6rem 0.75rem; color:var(--text-primary); font-size:0.875em; resize:vertical; font-family:inherit;"></textarea>
                </div>
            </td>
            <td style="vertical-align:top; padding-top:1rem;">
                <div class="status-toggle" style="display:flex; flex-direction:column; gap:6px;">
                    <button data-tcid="${tcId}" onclick="setExecStatus(this,'pass')">Pass</button>
                    <button data-tcid="${tcId}" onclick="setExecStatus(this,'fail')">Fail</button>
                    <button data-tcid="${tcId}" onclick="setExecStatus(this,'block')">Block</button>
                </div>
            </td>
        </tr>`;

        rtmHtml += `<tr>
            <td>${storyId}</td>
            <td>${tcId}</td>
            <td><span class="rtm-status" data-tcid="${tcId}">Untested</span></td>
        </tr>`;

        counter++;
    }
    
    execHtml += '</tbody></table>';
    rtmHtml  += '</tbody></table>';
    
    execOutput.innerHTML = execHtml;
    if (rtmOutput) rtmOutput.innerHTML = rtmHtml;
    
    const execExport = document.getElementById('exec-export-buttons');
    if (execExport) execExport.classList.remove('hidden');
    
    const rtmExport = document.getElementById('rtm-export-buttons');
    if (rtmExport) rtmExport.classList.remove('hidden');
}

function setExecStatus(btn, status) {
    const group = btn.parentElement;
    const tcId = btn.dataset.tcid;
    
    group.querySelectorAll('button').forEach(b => b.className = '');
    
    let statusText = 'Untested';
    let statusColor = varColor('--text-secondary');
    
    if (status === 'pass') {
        btn.classList.add('active-pass');
        statusText = 'PASSED';
        statusColor = varColor('--status-success');
    }
    if (status === 'fail') {
        btn.classList.add('active-fail');
        statusText = 'FAILED';
        statusColor = varColor('--status-error');
    }
    if (status === 'block') {
        btn.classList.add('active-block');
        statusText = 'BLOCKED';
        statusColor = varColor('--status-blocked');
    }
    
    // Update status badge inside the exec row (if present)
    const badge = group.querySelector('.exec-status-badge');
    if (badge) {
        badge.innerText = statusText;
        badge.style.color = statusColor;
    }
    
    // Update RTM — iterate all cells and match via dataset to avoid CSS selector issues
    // with special characters in TC IDs (underscores, dots, etc.)
    document.querySelectorAll('.rtm-status').forEach(cell => {
        if (cell.dataset.tcid === tcId) {
            cell.innerText = statusText;
            cell.style.color = statusColor;
            cell.style.fontWeight = '600';
        }
    });
}


function varColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// --- 6. Bug Report ---
async function generateBugReport() {
    const notes = document.getElementById('bug-notes').value;
    const tcId = document.getElementById('bug-tc-id').value;
    const output = document.getElementById('bug-output');
    
    if(!notes) { output.innerHTML = '<span style="color:var(--status-warning)">Please enter rough notes.</span>'; return;}
    
    output.innerHTML = 'Generating formal bug report...';
    try {
        const payload = { 
            "bugs": `Test Case ID: ${tcId || 'None'}\nNotes: ${notes}\n\nINSTRUCTION: Please return the bug report as exactly ONE markdown table with these columns: | Bug ID | Description | Steps to Reproduce | Expected Behavior | Actual Behavior | Priority | Severity | Status |. Infere Bug ID starting from KAN-B001 and Priority/Severity based on context.` 
        };
        const res = await fetch('https://api-mg.onrender.com/generate-bug-report', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        const content = data.output || data.response || JSON.stringify(data);
        
        // Render markdown table if possible, else fallback to pre
        if (content.includes('|')) {
            output.innerHTML = `<div class="table-container">${parseMarkdownTableToHTML(content)}</div>`;
        } else {
            output.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>`;
        }
        const bugExport = document.getElementById('bug-export-buttons');
        if (bugExport) bugExport.classList.remove('hidden');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--status-error)">Error generating bug report: ${err.message}</span>`;
    }
}


// ==========================================
// REAL API INTEGRATIONS (Python Unified Server)
// ==========================================
const API_BASE = '/api';

async function fetchJiraStory(inputId = 'jira-issue-id', outputId = 'req-input') {
    const input = document.getElementById(outputId);
    let idElement = document.getElementById(inputId);
    const issueId = idElement ? idElement.value.trim() : '';
    if (!issueId) {
        alert("Please enter a Jira Issue ID first.");
        return;
    }

    input.value = "Fetching from Jira...";
    try {
        const response = await fetch(`${API_BASE}/jira/issue/bulkfetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                expand: ["names"],
                fields: ["summary", "project", "assignee", "description"],
                fieldsByKeys: false,
                issueIdsOrKeys: [issueId],
                properties: []
            })
        });
        
        const data = await response.json();
        if (data && data.issues && data.issues.length > 0) {
            const issue = data.issues[0];
            const summary = issue.fields.summary || "No Summary";
            const projectName = issue.fields.project ? issue.fields.project.name : "Unknown Project";
            const assigneeName = issue.fields.assignee ? issue.fields.assignee.displayName : "Unassigned";
            
            // Check for description object (Jira Document format) or plain string
            let descriptionText = "No Description";
            if (issue.fields.description && issue.fields.description.content) {
                // Extract Atlassian Document Format text while handling paragraphs and newlines
                descriptionText = issue.fields.description.content
                    .map(block => {
                        if (block.content) {
                            return block.content.map(c => c.text || (c.type === 'hardBreak' ? '\n' : '')).join('');
                        }
                        return '';
                    })
                    .join('\n\n');
            } else if (typeof issue.fields.description === 'string') {
                descriptionText = issue.fields.description;
            }
            
            input.value = `User Story ID: ${issue.key}\nProject: ${projectName}\nAssignee: ${assigneeName}\nSummary: ${summary}\n\nDescription:\n${descriptionText.trim()}`;
            console.log("Successfully fetched Jira issue:", issue.key);
        } else {
            input.value = "Issue not found or no data returned in payload.";
        }
    } catch (error) {
        console.error("Fetch error", error);
        input.value = "Failed to fetch from Jira. Check browser console and ensure the API bridge (http://localhost:3000) is running.";
    }
}

async function exportTestPlanToJira() {
    alert("Test Plan Export is not mapped to a specific Zephyr endpoint yet. Placeholder for future Confluence POST integration.");
}

async function pushTestCasesToJira() {
    const table = document.querySelector('#tc-output table');
    if(!table) { 
        alert("No test cases generated yet.");
        return; 
    }
    
    // Extract data from the editable HTML table
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const execRows = document.querySelectorAll('#exec-output tbody tr');
    const rtmRows = document.querySelectorAll('#rtm-output tbody tr');
    const btn = document.querySelector('#module-testcase .btn.jira');
    const origText = btn.innerText;
    btn.innerText = "Pushing to Zephyr...";

    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const cells = tr.querySelectorAll('td');
        const scenarioName = cells[1].innerText || "Generated Test Case";
        const steps = cells[2].innerText || "";
        const expected = cells[3].innerText || "";

        const payload = {
            projectKey: "KAN", // Required project key from collection
            name: scenarioName,
            objective: `Steps: ${steps} | Expected: ${expected}`,
            precondition: "System available",
            statusName: "Draft"
        };
        
        try {
            const res = await fetch(`${API_BASE}/zephyr/testcase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                successCount++;
                const data = await res.json();
                if (data && data.key) {
                    const newKey = data.key;
                    // Update test case table first cell
                    cells[0].innerText = newKey;
                    
                    // Update execution row — both the TC ID cell and all button data-tcid attributes
                    if (execRows[i]) {
                        execRows[i].querySelector('td').innerText = newKey;
                        execRows[i].querySelectorAll('button[data-tcid]').forEach(btn => {
                            btn.dataset.tcid = newKey;
                        });
                    }
                    
                    // Update RTM row TC ID cell and status span data-tcid
                    if (rtmRows[i]) {
                        rtmRows[i].querySelectorAll('td')[1].innerText = newKey;
                        const statusSpan = rtmRows[i].querySelector('.rtm-status');
                        if (statusSpan) statusSpan.dataset.tcid = newKey;
                    }
                }
            }
        } catch(err) {
            console.error("Error pushing Test Case to Zephyr:", err);
        }
    }
    
    btn.innerText = `✓ Created ${successCount} Cases`;
    setTimeout(() => btn.innerText = origText, 3000);
}

async function syncExecutionToJira() {
    const execRows = document.querySelectorAll('#exec-output tbody tr');
    if (execRows.length === 0) {
        alert('No test cases in the execution table yet.');
        return;
    }

    const cycleKey = document.getElementById('exec-cycle-key').value.trim() || 'KAN-R1';
    const btn = document.querySelector('#module-execution .btn.jira');
    const origText = btn ? btn.innerText : '';
    if (btn) btn.innerText = 'Syncing...';

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let tr of execRows) {
        let status = null;
        if (tr.querySelector('.status-toggle button.active-pass'))  status = 'Pass';
        if (tr.querySelector('.status-toggle button.active-fail'))  status = 'Fail';
        if (tr.querySelector('.status-toggle button.active-block')) status = 'Blocked';
        
        if (!status) continue; // skip Untested rows

        // Read TC ID from button data-tcid — most reliable source
        const statusBtn = tr.querySelector('.status-toggle button[data-tcid]');
        const tcId = statusBtn ? statusBtn.dataset.tcid : tr.querySelector('td')?.innerText?.trim();

        if (!tcId) continue;

        try {
            const res = await fetch(`${API_BASE}/zephyr/execution`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectKey: 'KAN',
                    testCaseKey: tcId,
                    testCycleKey: cycleKey,
                    statusName: status
                })
            });
            const responseData = await res.json().catch(() => ({}));
            if (res.ok) {
                successCount++;
            } else {
                errorCount++;
                errors.push(`${tcId}: ${responseData.message || responseData.error || res.status}`);
            }
        } catch(err) {
            errorCount++;
            errors.push(`${tcId}: ${err.message}`);
        }
    }

    if (btn) {
        if (errorCount === 0 && successCount > 0) {
            btn.innerText = `✓ Synced ${successCount} TC(s)`;
        } else if (successCount === 0 && errorCount === 0) {
            btn.innerText = 'No statused TCs to sync';
        } else {
            btn.innerText = `✓${successCount} ✗${errorCount}`;
        }
        setTimeout(() => btn.innerText = origText, 4000);
    }

    if (errors.length > 0) {
        console.error('Sync errors:', errors);
        // Show errors in the RTM output area as user-facing feedback
        const rtmOutput = document.getElementById('rtm-output');
        if (rtmOutput) {
            const errDiv = document.createElement('div');
            errDiv.style.cssText = 'margin-top:1rem; color:var(--status-error); font-size:0.85em;';
            errDiv.innerHTML = `<strong>Sync Errors:</strong><br>${errors.join('<br>')}`;
            rtmOutput.appendChild(errDiv);
        }
    }
}


async function createJiraBug() {
    const bugOutput = document.getElementById('bug-output');
    const table = bugOutput.querySelector('table');
    const btn = document.querySelector('#module-bugreport .btn.jira');
    const origText = btn.innerText;

    const createSingleBug = async (summary, description) => {
        try {
            const response = await fetch(`${API_BASE}/jira/bug`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        project: { id: "10000" }, // Using KAN project ID
                        issuetype: { id: "10005" }, // Bug issuetype ID
                        summary: summary,
                        description: {
                            type: "doc",
                            version: 1,
                            content: [{ type: "paragraph", content: [{ text: description, type: "text" }] }]
                        }
                    }
                })
            });
            const data = await response.json();
            return data.key || null;
        } catch (err) {
            console.error("Create Jira Bug Error:", err);
            return null;
        }
    };

    if (table) {
        // Multi-Bug creation from table
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        let successKeys = [];
        let total = rows.length;

        btn.innerText = `Preparing ${total} issue(s)...`;
        btn.disabled = true;

        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length < 5) continue;

            const bugId = cells[0].innerText.trim();
            const summary = `[QA Bug] ${cells[1].innerText.trim()}`;
            const description = `Bug ID: ${bugId}\n\nSteps to Reproduce:\n${cells[2].innerText.trim()}\n\nExpected:\n${cells[3].innerText.trim()}\n\nActual:\n${cells[4].innerText.trim()}\n\nPriority: ${cells[5]?.innerText.trim()}\nSeverity: ${cells[6]?.innerText.trim()}`;

            btn.innerText = `Creating ${i + 1}/${total}...`;
            const key = await createSingleBug(summary, description);
            if (key) {
                successKeys.push(key);
                // Mark success on the table if possible
                cells[0].innerHTML += ` <span style="color:var(--status-success); font-size:0.7em;">(${key})</span>`;
            }
        }

        btn.disabled = false;
        if (successKeys.length > 0) {
            btn.innerText = `✓ Created ${successKeys.length} Bugs`;
        } else {
            btn.innerText = "Failed";
        }
    } else {
        // Fallback: Single bug from notes/raw content
        const notes = document.getElementById('bug-notes').value;
        const content = bugOutput.innerText || notes;
        btn.innerText = "Creating Issue...";
        const key = await createSingleBug("[QA Report] Discovered Application Bug", content);
        if (key) {
            btn.innerText = `✓ Created ${key}`;
        } else {
            btn.innerText = "Failed";
        }
    }
    
    setTimeout(() => {
        btn.innerText = origText;
        btn.disabled = false;
    }, 4000);
}

// --- Utils: Export & Copy ---
function exportTableToCSV(tableSelector, filename) {
    const table = document.querySelector(tableSelector);
    if (!table) {
        alert("No table found to export.");
        return;
    }
    
    const rows = Array.from(table.querySelectorAll('tr'));
    const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => {
            let text = cell.innerText.replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, ' ').trim();
            return `"${text}"`;
        }).join(',');
    }).filter(line => line.length > 0).join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || 'export.csv';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 100);
}

function copyOutput(containerSelector) {
    const container = document.querySelector(containerSelector);
    if(!container) return;
    
    let textToCopy = "";
    const table = container.querySelector('table');
    
    if (table) {
        // If it's a table, copy as tab-separated values (TSV) for Excel
        const rows = Array.from(table.querySelectorAll('tr'));
        textToCopy = rows.map(row => {
            const cols = Array.from(row.querySelectorAll('td, th'));
            return cols.map(col => col.innerText.trim().replace(/\n/g, ' ')).join('\t');
        }).join('\n');
    } else {
        textToCopy = container.innerText;
    }
    
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert("COPY SUCCESS: Content formatted and copied to clipboard.");
    } catch (err) {
        console.error("COPY ERROR:", err);
    }
    document.body.removeChild(textarea);
}

// Helper to filter markdown columns for HLS
function filterHLSColumns(markdown) {
    const lines = markdown.trim().split('\n');
    if (lines.length < 2) return markdown;

    const rowSplit = lines[0].split('|').map(c => c.trim());
    const headerCols = rowSplit.filter((c, idx) => !(idx === 0 && c === '') && !(idx === rowSplit.length - 1 && c === ''));
    
    const keepers = [];
    const desiredCols = ['User Story ID', 'Scenario ID', 'User Story Name', 'Module', 'Scenario Description'];
    
    headerCols.forEach((h, index) => {
        const lower = h.toLowerCase();
        let mapped = null;
        if (lower.includes('user story id')) mapped = 'User Story ID';
        else if (lower.includes('user story name')) mapped = 'User Story Name';
        else if (lower.includes('module')) mapped = 'Module';
        else if (lower.includes('scenario description') || lower.includes('test case description')) mapped = 'Scenario Description';
        else if (lower.includes('scenario id') || lower.includes('test case id') || lower.includes('test case title')) mapped = 'Scenario ID';
        
        if (mapped && !keepers.find(k => k.mapped === mapped)) {
            keepers.push({ index: index, mapped: mapped });
        }
    });

    if (keepers.length === 0) return markdown;

    keepers.sort((a, b) => desiredCols.indexOf(a.mapped) - desiredCols.indexOf(b.mapped));

    let newTable = [];
    for (let i = 0; i < lines.length; i++) {
        const pSplit = lines[i].split('|').map(c => c.trim());
        const row = pSplit.filter((c, idx) => !(idx === 0 && c === '') && !(idx === pSplit.length - 1 && c === ''));
        
        if (row.length === 0) continue;
        
        if (i === 1) { 
            newTable.push('| ' + keepers.map(() => '---').join(' | ') + ' |');
            continue;
        }

        let newRow = '|';
        for (let j = 0; j < keepers.length; j++) {
            if (i === 0) {
                newRow += ` ${keepers[j].mapped} |`;
            } else {
                newRow += ` ${row[keepers[j].index] || ''} |`;
            }
        }
        newTable.push(newRow);
    }
    
    return newTable.join('\n');
}
