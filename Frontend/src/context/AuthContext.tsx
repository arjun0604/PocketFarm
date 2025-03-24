import React, { createContext, useContext, useState, useEffect } from 'react';

// Add type declaration for Google client
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: string;
            callback: (response: any) => void;
          }) => {
            requestCode: () => void;
          };
        };
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: any) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
    atob: (base64: string) => string;
  }
}

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
  signup: (name: string, email: string, password: string, phone: string, location: { latitude: number | null; longitude: number | null }) => Promise<User & { verification_sent?: boolean }>;
  googleSignIn: () => Promise<void>;
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
  const [googleApiLoaded, setGoogleApiLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);

    // Load the Google Sign-In API
    const loadGoogleApi = () => {
      // Check if already loaded
      if (window.google && window.google.accounts && window.google.accounts.id) {
        console.log('Google API already loaded');
        setGoogleApiLoaded(true);
        return;
      }
      
      console.log('Loading Google Identity Services API...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Identity Services API loaded');
        // Set a short delay to ensure the API is fully initialized
        setTimeout(() => {
          if (window.google && window.google.accounts && window.google.accounts.id) {
            console.log('Google Identity Services API initialized');
            setGoogleApiLoaded(true);
          } else {
            console.error('Google Identity Services API failed to initialize properly');
          }
        }, 500);
      };
      document.body.appendChild(script);
    };

    loadGoogleApi();
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

      const errorData = await response.json();

      if (!response.ok) {
        // Handle password validation errors specially
        if (response.status === 400 && errorData.password_errors) {
          throw new Error(JSON.stringify(errorData));
        }
        // Handle email already exists error (409 Conflict status)
        if (response.status === 409) {
          throw new Error('email_exists');
        }
        throw new Error(errorData.error || 'Signup failed');
      }

      // If email verification is required, don't set the user data yet
      if (!errorData.verification_sent) {
        setUser(errorData);
        localStorage.setItem('user', JSON.stringify(errorData));
      }
      
      return errorData;
    } catch (error) {
      console.error('Signup error:', error);
      setLoginError(error instanceof Error ? error.message : 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async () => {
    setLoginError(null);
    setIsLoading(true);
    
    try {
      if (!googleApiLoaded) {
        throw new Error('Google API not loaded yet. Please try again in a moment.');
      }
      
      return new Promise<void>((resolve, reject) => {
        // Check if Google API is available in the window object
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
          setLoginError('Google Sign-In API not properly loaded');
          setIsLoading(false);
          reject(new Error('Google Sign-In API not properly loaded'));
          return;
        }
        
        // Use a simpler approach directly with Google's gsi/client library
        window.google.accounts.id.initialize({
          client_id: '515812611594-mth37t3mrcuo5f7tqfjad8ptcqq70k1f.apps.googleusercontent.com',
          callback: async (response) => {
            try {
              // Decode the JWT token to extract user information
              // This is safe to do client-side as we're only extracting basic profile info
              const base64Url = response.credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const payload = JSON.parse(window.atob(base64));
              
              console.log('Google sign-in successful, sending to backend...');
              
              // Send user data to our backend
              const tokenResponse = await fetch('http://127.0.0.1:5000/google_auth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ 
                  code: response.credential,  // Still send the original token
                  email: payload.email,
                  name: payload.name 
                }),
              });
              
              const responseData = await tokenResponse.json();
              
              if (!tokenResponse.ok) {
                const errorMessage = responseData.error || 'Google authentication failed';
                console.error('Auth error response:', responseData);
                throw new Error(errorMessage);
              }
              
              console.log('Auth successful, setting user data');
              setUser(responseData);
              localStorage.setItem('user', JSON.stringify(responseData));
              setIsLoading(false);
              resolve();
            } catch (error) {
              console.error('Google auth error:', error);
              setLoginError(error instanceof Error ? error.message : 'Google authentication failed');
              setIsLoading(false);
              reject(error);
            }
          },
        });
        
        try {
          console.log('Prompting for Google sign-in...');
          window.google.accounts.id.prompt();
        } catch (error) {
          console.error('Error requesting Google sign-in:', error);
          setLoginError('Failed to start Google authentication');
          setIsLoading(false);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setLoginError(error instanceof Error ? error.message : 'Google Sign-In failed');
      setIsLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        signup,
        googleSignIn,
        isAuthenticated: !!user,
        isLoading,
        loginError,
        deleteAccount,
        updateUserProfile
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