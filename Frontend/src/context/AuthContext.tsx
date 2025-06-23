import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  location?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
}

interface UpdateUserProfileData {
  name?: string;
  email?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string, phone: string, location: { latitude: number | null; longitude: number | null }) => Promise<User>;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  deleteAccount: () => Promise<void>;
  updateUserProfile: (data: UpdateUserProfileData) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const validateEmail = (email: string): boolean => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const login = async (email: string, password: string) => {
    setLoginError(null);
    setIsLoading(true);
    
    try {
      // Validate email format
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const response = await fetch('http://127.0.0.1:5000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Special handling for email verification errors
        if (response.status === 403 && data.requires_verification) {
          throw new Error(`Email not verified ${JSON.stringify({
            email: data.email,
            user_id: data.user_id
          })}`);
        }
        throw new Error(data.error || 'Login failed');
      }

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No user is currently logged in');
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('http://127.0.0.1:5000/delete_account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }
      
      // Clear local user data
      logout();
      
    } catch (error) {
      console.error('Account deletion error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = (data: UpdateUserProfileData) => {
    if (!user) {
      return;
    }
    
    // Update the user data in state
    const updatedUser = {
      ...user,
      ...data
    };
    
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const signup = async (name: string, email: string, password: string, phone: string, location: { latitude: number | null; longitude: number | null }) => {
    setLoginError(null);
    setIsLoading(true);
    
    try {
      // Validate email format
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const response = await fetch('http://127.0.0.1:5000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone, location }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle password validation errors specially
        if (response.status === 400 && data.password_errors) {
          throw new Error(JSON.stringify(data));
        }
        // Handle email already exists error (409 Conflict status)
        if (response.status === 409) {
          throw new Error('email_exists');
        }
        throw new Error(data.error || 'Signup failed');
      }

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      setLoginError(error instanceof Error ? error.message : 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
        user,
        login,
        logout,
        signup,
        isAuthenticated: !!user,
        isLoading,
        loginError,
        deleteAccount,
        updateUserProfile
    }}>
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