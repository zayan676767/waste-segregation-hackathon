/**
 * Thin API client.
 *
 * Every path is RELATIVE on purpose. Vite proxies /api to the backend in dev,
 * so the exact same build works on localhost, over the LAN, and through an
 * https tunnel with no base URL to configure or forget.
 */

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    // Network-level failure: the backend is not running or unreachable.
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. an HTML error page from a proxy).
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.errors);
  }

  return data;
}

export class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors || null;
  }
}

export const api = {
  getCategories: () => request('GET', '/api/categories'),
  createCategory: (body) => request('POST', '/api/categories', body),
  updateCategory: (id, body) => request('PUT', `/api/categories/${id}`, body),
  deleteCategory: (id) => request('DELETE', `/api/categories/${id}`),

  getSettings: () => request('GET', '/api/settings'),
  updateSettings: (body) => request('PUT', '/api/settings', body),

  getLabelMap: () => request('GET', '/api/label-map'),
  createMapping: (body) => request('POST', '/api/label-map', body),
  updateMapping: (id, body) => request('PUT', `/api/label-map/${id}`, body),
  deleteMapping: (id) => request('DELETE', `/api/label-map/${id}`),

  getScans: (params = '') => request('GET', `/api/scans${params}`),
  createScan: (body) => request('POST', '/api/scans', body),
  clearScans: () => request('DELETE', '/api/scans'),

  getStats: () => request('GET', '/api/stats'),
  getHealth: () => request('GET', '/api/health'),

  // Vision. classify() sends one image and returns the identified item plus the
  // scan row the backend wrote for it.
  classify: (body) => request('POST', '/api/classify', body),
  getClassifyStatus: () => request('GET', '/api/classify/status')
};
