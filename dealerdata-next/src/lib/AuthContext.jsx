'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const currentUser = await res.json();
        if (currentUser && currentUser.id) {
          setUser(currentUser);
          setIsAuthenticated(true);
          return currentUser;
        }
      }
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } catch (e) {
      console.warn('Auth check failed:', e);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async ({ email, password }) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const signup = async ({ full_name, email, password, company_name }) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, email, password, company_name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const demoLogin = async (role = 'admin') => {
    const creds = {
      admin: { email: 'admin@dealerdata.com', password: 'admin123' },
      manager: { email: 'manager@aaronford.com', password: 'manager123' },
      analyst: { email: 'analyst@dealerdata.com', password: 'analyst123' },
    }[role] || { email: 'admin@dealerdata.com', password: 'admin123' };

    return login(creds);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      setAuthError,
      login,
      signup,
      demoLogin,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
