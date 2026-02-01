import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ApiService from '../services/api';

interface User {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  hour_balance: number;
  type_id: number;
  account_type_name: string;
  terms_accepted?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      // First check if we have a token
      const token = await ApiService.getStoredToken();
      if (!token) {
        console.log('🔐 No token found, user not authenticated');
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      
      // Try to get user profile to check if token is valid
      const response = await ApiService.getProfile();
      if (response.success && response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      // Token is invalid or expired
      console.log('🔐 Token validation failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is already logged in on app start
  useEffect(() => {
    const initializeAuth = async () => {
      // Initialize token from AsyncStorage first
      await ApiService.initializeToken();
      // Then check auth status
      await checkAuthStatus();
    };
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      setIsLoading(true);
      // Use AJAX login method
      const response = await ApiService.login(email, password);
      
      if (response.success && response.data && response.data.user) {
        // Token is automatically stored by ApiService.login()
        setUser(response.data.user);
        setIsAuthenticated(true);
        return { success: true, user: response.data.user };
      }
      // Return the error message from the server response
      return { success: false, error: response.message || 'Invalid email or password' };
    } catch (error) {
      // Pass through the actual error message
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection and try again.';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await ApiService.logout();
    } catch (error) {
      // Silent logout - no console errors needed
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;