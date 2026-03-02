// src/renderer/initWebSocket.js
// ───────────────────────────────────────────────────────────────────────────────
// The “ensureWebSocketAPI” IIFE
export default function initWebSocketAPI() {
    (function ensureWebSocketAPI() {
      console.log('[Renderer] Checking for WebSocket API availability…');
      if (window.agentWebSocket && typeof window.agentWebSocket.connect === 'function') {
        console.log('[Renderer] WebSocket API is available and properly initialized');
        return;
      }
      console.warn('[Renderer] window.agentWebSocket is undefined or incomplete – attempting recovery…');
      if (typeof window.__recoverWebSocketAPI === 'function') {
        console.log('[Renderer] Found preload recovery function, attempting restore…');
        try {
          const recovered = window.__recoverWebSocketAPI();
          console.log(`[Renderer] Recovery ${recovered ? 'successful' : 'failed'}`);
          if (recovered && window.agentWebSocket && typeof window.agentWebSocket.connect === 'function') {
            console.log('[Renderer] WebSocket API successfully recovered from preload');
            return;
          }
        } catch (err) {
          console.error('[Renderer] Error during recovery:', err);
        }
      }
      console.warn('[Renderer] Unable to recover WebSocket API – providing fallback implementation');
      window.agentWebSocket = {
        _mockState: { attempted: false, errors: [], recoveryAttempts: 0 },
        connect: async (url, apiKey) => {
          window.agentWebSocket._mockState.attempted = true;
          window.agentWebSocket._mockState.lastAttempt = Date.now();
          window.agentWebSocket._mockState.url = url;
          const err = new Error(
            'WebSocket API not available (window.agentWebSocket is undefined). ' +
            'This may indicate a problem with the preload script initialization or contextBridge permissions. ' +
            'API Error: The WebSocket API may not be properly initialized. This could indicate an issue with ' +
            'the electron preload script or contextBridge setup.'
          );
          err.diagnostics = {
            electronAPIAvailable: !!window.electronAPI,
            configAPIAvailable: !!window.config,
            availableAPIs: Object.keys(window || {}).filter(k => k.includes('API')),
            mockImplementation: true,
            mockAttempts: ++window.agentWebSocket._mockState.recoveryAttempts
          };
          window.agentWebSocket._mockState.errors.push({ time: new Date().toISOString(), message: err.message });
          throw err;
        },
        isAvailable: () => false,
        getDiagnostics: () => ({
          ...window.agentWebSocket._mockState,
          isMock: true,
          createdAt: new Date().toISOString(),
          electronAPIAvailable: !!window.electronAPI,
          configAPIAvailable: !!window.config
        })
      };
      let checkCount = 0, maxChecks = 10;
      const checkForRealAPI = setInterval(() => {
        checkCount++;
        console.log(`[Renderer] Recovery check #${checkCount}/${maxChecks} for WebSocket API`);
        if (typeof window.__recoverWebSocketAPI === 'function') {
          try {
            const recovered = window.__recoverWebSocketAPI();
            if (recovered) { console.log('[Renderer] Recovered via preload'); clearInterval(checkForRealAPI); return; }
          } catch {}
        }
        if (window.electronAPI && window.electronAPI.agentReconnect) {
          window.electronAPI.agentReconnect()
            .then(r => {
              if (r && r.agentDisabled) {
                console.log('[Renderer] Agent disabled, skipping recovery checks');
                clearInterval(checkForRealAPI);
              } else if (window.agentWebSocket && !window.agentWebSocket._mockState) {
                console.log('[Renderer] Real WebSocket API now available');
                clearInterval(checkForRealAPI);
              }
            })
            .catch(() => {});
        }
        if (checkCount >= maxChecks) {
          console.log(`[Renderer] Stopping frequent checks after ${maxChecks} attempts`);
          clearInterval(checkForRealAPI);
          setInterval(() => {
            console.log('[Renderer] Periodic WebSocket API recovery check');
            if (window.agentWebSocket && window.agentWebSocket._mockState) {
              if (typeof window.__recoverWebSocketAPI === 'function') {
                try { window.__recoverWebSocketAPI(); } catch {}
              }
              if (window.electronAPI && window.electronAPI.agentReconnect) {
                window.electronAPI.agentReconnect().catch(() => {});
              }
            }
          }, 30000);
        }
      }, 1000);
    })();
  }
  