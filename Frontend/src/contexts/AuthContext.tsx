import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  name: string;
  email: string;
  email_verified?: boolean;
  location?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string, phone: string, location: { latitude: number; longitude: number }) => Promise<{verified: boolean, message?: string}>;
  googleSignIn: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        // Only set as authenticated user if email is verified
        if (userData.email_verified) {
          setUser(userData);
        } else {
          // If not verified, clear storage
          localStorage.removeItem('user');
        }
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setLoginError(null);
      
      const response = await fetch('http://127.0.0.1:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.status === 403 && data.requires_verification) {
        // Email not verified - redirect to verification page
        navigate('/need-verification', { state: { email: data.email, userId: data.user_id } });
        throw new Error('Email not verified');
      }
      
      if (!response.ok) {
        setLoginError(data.error || 'Login failed');
        throw new Error(data.error || 'Login failed');
      }

      // Only store user if email is verified
      if (data.email_verified) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const signup = async (name: string, email: string, password: string, phone: string, location: { latitude: number; longitude: number }) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('http://127.0.0.1:5000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone, location }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Do not set user or store in localStorage until email is verified
      // Instead, return success with verification needed
      return {
        verified: false,
        message: data.message || 'Please check your email to verify your account'
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const googleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Use google gsi to get ID token (assuming Google Sign-In is loaded)
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        throw new Error('Google Sign-In not loaded');
      }
      
      // Get client ID from window object (set in index.html)
      const clientId = window.googleClientId || '515812611594-mth37t3mrcuo5f7tqfjad8ptcqq70k1f.apps.googleusercontent.com';
      
      return new Promise<void>((resolve, reject) => {
        // Initialize Google Sign-In
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: {credential: string}) => {
            try {
              // Get user info from ID token payload or Google API
              const credential = response.credential;
              const payload = JSON.parse(atob(credential.split('.')[1]));
              
              // Now send this to our backend to create/login user
              const serverResponse = await fetch('http://127.0.0.1:5000/google_auth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: payload.email,
                  name: payload.name,
                  code: credential
                }),
              });
              
              const userData = await serverResponse.json();
              
              if (!serverResponse.ok) {
                throw new Error(userData.error || 'Google auth failed');
              }
              
              // Email is automatically verified with Google auth
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
              resolve();
            } catch (error) {
              console.error("Google auth error:", error);
              reject(error);
            }
          }
        });
        
        // Prompt user for Google Sign-In
        window.google.accounts.id.prompt();
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginError,
        login,
        logout,
        signup,
        googleSignIn
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 