import axios from 'axios';

// Ensure this matches your backend URL.
// In Docker, client-side requests go to localhost:8000 externally.
// Use same origin with /api prefix, which Next.js will proxy
// This avoids CORS and IP issues entirely
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Global Axios instance configured with base URL and default headers.
 * Used for all API requests to the backend.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Sets the authentication token for all future API requests.
 * Also persists the token in localStorage for session persistence.
 * 
 * @param token - The JWT access token or null to clear it.
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }
};

// Initialize token from storage if available
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) {
    setAuthToken(token);
  }
}

export default api;
