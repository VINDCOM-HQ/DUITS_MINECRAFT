/**
 * Agent Proxy IPC handler
 * Proxies HTTP/HTTPS requests from renderer to agent server
 */
const fs = require('fs');
const axios = require('axios');
const https = require('https');

function register(ipcMain) {
  ipcMain.handle('agent-proxy-request', async (_e, request) => {
    const { method, useSSL, apiKey, caFile } = request;
    // Use let for url and data so we can modify them
    let { url, data } = request;

    // Debug log for troubleshooting
    console.log(`[AGENT-PROXY] ${method} ${url}`, {
      hasData: !!data,
      dataType: data ? typeof data : 'none',
      isObject: data ? typeof data === 'object' : false,
      keys: data && typeof data === 'object' ? Object.keys(data) : []
    });

    try {
      const options = {
        method,
        headers: { 'x-api-key': apiKey }
      };

      // Handle different HTTP methods appropriately
      if (method === 'GET' && data && typeof data === 'object') {
        // For GET requests, parameters should be in the query string, not the body
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        }

        // Add query parameters to URL
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${queryParams.toString()}`;

        console.log(`[AGENT-PROXY] Modified GET URL with params: ${url}`);

        // Clear data for GET requests as we've moved it to the URL
        data = null;
      } else if (data) {
        // Handle file data for SMB write operations
        if (url.includes('/smb/writeFile') && data.data) {
          if (Buffer.isBuffer(data.data)) {
            data.data = data.data.toString('base64');
            options.headers['Content-Type'] = 'application/json';
            options.headers['X-File-Encoding'] = 'base64';
          }
        }

        options.data = data;
      }

      // Set up TLS/SSL options if enabled
      if (useSSL && caFile) {
        try {
          const ca = fs.readFileSync(caFile);
          options.httpsAgent = new https.Agent({ ca });
        } catch (err) {
          console.error('Failed to load CA file for agent request:', err);
        }
      }

      // Make the request using axios
      const axiosConfig = {
        url,
        method,
        headers: options.headers,
      };

      if (options.httpsAgent) {
        axiosConfig.httpsAgent = options.httpsAgent;
      }

      if (method !== 'GET' && data) {
        console.log(`[AGENT-PROXY] Sending ${method} data:`, data);
        axiosConfig.data = data;
      }

      console.log(`[AGENT-PROXY] Sending ${method} request to: ${url}`);

      try {
        const response = await axios.request(axiosConfig);
        console.log(`[AGENT-PROXY] Response status: ${response.status}`);
        return response.data;
      } catch (axiosErr) {
        console.error(`[AGENT-PROXY] Request failed:`, {
          status: axiosErr.response?.status,
          statusText: axiosErr.response?.statusText,
          data: axiosErr.response?.data
        });
        if (axiosErr.response && axiosErr.response.data && axiosErr.response.data.error) {
          throw new Error(axiosErr.response.data.error);
        }
        throw axiosErr;
      }
    } catch (err) {
      console.error('Agent proxy request error:', err.message);
      throw new Error(`Agent request failed: ${err.message}`);
    }
  });
}

module.exports = { register };
