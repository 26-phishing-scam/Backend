const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const apiUrl = (path = '') => {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const next = path.startsWith('/') ? path : `/${path}`;
  return `${base}${next}`;
};

export const apiFetch = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};
