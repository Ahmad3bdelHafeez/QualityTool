import os
import requests
from flask import Flask, request, jsonify, send_from_directory, render_template
from dotenv import load_dotenv
import base64

# Load environment variables from .env
load_dotenv()

# Serve static files from the current directory
app = Flask(__name__, static_folder='.', static_url_path='')

PORT = int(os.getenv('PORT', 3000))

JIRA_DOMAIN = os.getenv('JIRA_DOMAIN', 'fergany')
JIRA_EMAIL = os.getenv('JIRA_EMAIL', '')
JIRA_API_TOKEN = os.getenv('JIRA_API_TOKEN', '')
ZEPHYR_API_TOKEN = os.getenv('ZEPHYR_API_TOKEN', '')

# Pre-compute headers for Jira (Basic Base64 Auth)
jira_auth_str = f"{JIRA_EMAIL}:{JIRA_API_TOKEN}"
jira_auth_b64 = base64.b64encode(jira_auth_str.encode("utf-8")).decode("utf-8")
jira_headers = {
    'Authorization': f'Basic {jira_auth_b64}',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

# Pre-compute headers for Zephyr
zephyr_headers = {
    'Authorization': ZEPHYR_API_TOKEN,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

JIRA_BASE_URL = f"https://{JIRA_DOMAIN}.atlassian.net/rest/api/3"
ZEPHYR_BASE_URL = "https://prod-api.zephyr4jiracloud.com/v2"

# --- STATIC FILE ROUTING ---

@app.route('/')
def serve_index():
    # return send_from_directory('.', 'index.html')
    return render_template('index.html')

# --- API PROXY ROUTES ---

@app.route('/api/jira/issue/bulkfetch', methods=['POST'])
def fetch_jira_issues():
    try:
        resp = requests.post(f"{JIRA_BASE_URL}/issue/bulkfetch", json=request.json, headers=jira_headers)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jira/bug', methods=['POST'])
def create_jira_bug():
    try:
        resp = requests.post(f"{JIRA_BASE_URL}/issue", json=request.json, headers=jira_headers)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/zephyr/testcase', methods=['POST'])
def create_zephyr_testcase():
    try:
        resp = requests.post(f"{ZEPHYR_BASE_URL}/testcases", json=request.json, headers=zephyr_headers)
        if resp.text:
            return jsonify(resp.json()), resp.status_code
        return jsonify({}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/zephyr/execution', methods=['POST'])
def create_zephyr_execution():
    try:
        resp = requests.post(f"{ZEPHYR_BASE_URL}/testexecutions", json=request.json, headers=zephyr_headers)
        if resp.text:
            return jsonify(resp.json()), resp.status_code
        return jsonify({}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/zephyr/execution/<path:exec_id>', methods=['PUT'])
def update_zephyr_execution(exec_id):
    try:
        resp = requests.put(f"{ZEPHYR_BASE_URL}/testexecutions/{exec_id}", json=request.json, headers=zephyr_headers)
        if resp.text:
            return jsonify(resp.json()), resp.status_code
        return jsonify({}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print(f"\\n--- Unified Dashboard Server ---")
    print(f"Serving UI & API at: http://localhost:{PORT}")
    print(f"--------------------------------\\n")
    app.run(host='0.0.0.0', port=PORT, debug=False)
