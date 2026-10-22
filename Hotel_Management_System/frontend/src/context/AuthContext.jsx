/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

import { api } from '../services/api';

const AuthContext =
  createContext(null);

export function AuthProvider({
  children
}) {
  const [user, setUser] =
    useState(() => {
      try {
        return (
          JSON.parse(
            localStorage.getItem(
              'luxurystay_user'
            )
          ) || null
        );
      } catch {
        return null;
      }
    });

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        'luxurystay_user',
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem(
        'luxurystay_user'
      );
    }
  }, [user]);

  useEffect(() => {
    const handleAuthExpired = () => {
      localStorage.removeItem('luxurystay_token');
      setUser(null);
    };

    window.addEventListener(
      'luxurystay:auth-expired',
      handleAuthExpired
    );

    return () => {
      window.removeEventListener(
        'luxurystay:auth-expired',
        handleAuthExpired
      );
    };
  }, []);

  const login = async (
    email,
    password,
    idNumber = ''
  ) => {
    if (!email || !password) {
      throw new Error(
        'Please enter your email and password.'
      );
    }

    const data = await api(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          idNumber
        })
      }
    );

    localStorage.setItem(
      'luxurystay_token',
      data.token
    );

    setUser(data.user);

    return data.user;
  };

  const logout = async () => {
    try {
      if (
        localStorage.getItem(
          'luxurystay_token'
        )
      ) {
        await api(
          '/auth/logout',
          {
            method: 'POST'
          }
        );
      }
    } catch {
      // Local logout still works
      // if backend is unavailable.
    } finally {
      localStorage.removeItem(
        'luxurystay_token'
      );

      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser: (patch) => setUser((current) => (
          current ? { ...current, ...patch } : current
        )),
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth =
  () => useContext(AuthContext);