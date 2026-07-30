'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface User {
  id: string;
  name?: string;
  email?: string;
  picture?: string;
}

/** Three auth states:
 * - IS_AUTHENTICATED: logged in via OAuth/registration (USER or ADMIN role)
 * - IS_GUEST: browsing anonymously with a short-lived GUEST token
 * - IS_ANONYMOUS: no token at all (first visit or loggout)
 */
type AuthStatus = 'IS_AUTHENTICATED' | 'IS_GUEST' | 'IS_ANONYMOUS';

type Role = 'USER' | 'ADMIN' | 'GUEST';

interface AuthContextType {
  token: string | null;
  user: User | null;
  status: AuthStatus;
  role: Role | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  /** Gates the admin dashboard. Null role means we do not know yet. */
  isAdmin: boolean;
  login: (token: string, user: User, role?: Role) => void;
  setGuestToken: (token: string) => void;
  logout: () => void;
  /** Call when bookmark action fails for guests — shows upgrade prompt */
  showUpgradePrompt: boolean;
  triggerUpgradePrompt: () => void;
  dismissUpgradePrompt: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('IS_ANONYMOUS');
  const [role, setRole] = useState<Role | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const login = useCallback((newToken: string, newUser: User, newRole?: Role) => {
    setToken(newToken);
    setUser(newUser);
    setRole(newRole ?? 'USER');
    setStatus(newRole === 'GUEST' ? 'IS_GUEST' : 'IS_AUTHENTICATED');
    localStorage.setItem('harbinger_token', newToken);
    localStorage.setItem('harbinger_user', JSON.stringify(newUser));
    // Persisted so a refresh does not lose admin access. Authorisation is still
    // enforced server-side on every request — this only drives what the UI offers.
    localStorage.setItem('harbinger_role', newRole ?? 'USER');
  }, []);

  useEffect(() => {
    // Check for OAuth token from popup message (postMessage handler)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success') {
        const { token, user } = event.data.payload;
        login(token, user);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check for OAuth token from URL query params (fallback redirect)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthToken = urlParams.get('oauth_token');
      const oauthUser = urlParams.get('oauth_user');
      
      if (oauthToken && oauthUser) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(oauthUser));
          login(oauthToken, parsedUser);
          
          // Clean up URL - remove OAuth params
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('oauth_token');
          newUrl.searchParams.delete('oauth_user');
          window.history.replaceState({}, '', newUrl.toString());
        } catch (e) {
          console.error('Failed to parse OAuth user data:', e);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('oauth_token');
          newUrl.searchParams.delete('oauth_user');
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    }
    
    // Restore from localStorage if no OAuth redirect
    const storedToken = localStorage.getItem('harbinger_token');
    if (storedToken) {
      try {
        const userDataStr = localStorage.getItem('harbinger_user');
        const storedRole = localStorage.getItem('harbinger_role') as Role | null;
        setToken(storedToken);
        setUser(userDataStr ? JSON.parse(userDataStr) : null);
        setRole(storedRole ?? 'USER');
        setStatus(storedRole === 'GUEST' ? 'IS_GUEST' : 'IS_AUTHENTICATED');
      } catch {
        localStorage.removeItem('harbinger_token');
        localStorage.removeItem('harbinger_user');
        localStorage.removeItem('harbinger_role');
        localStorage.removeItem('harbinger_guest_token');
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [login]);

  const setGuestToken = useCallback((guestToken: string) => {
    setToken(guestToken);
    setUser({ id: 'guest' });
    setRole('GUEST');
    setStatus('IS_GUEST');
    // Guest tokens are stored in a separate key so logout only clears guest when explicit
    localStorage.setItem('harbinger_guest_token', guestToken);
    // Also store in main key for consistency with public API flow
    localStorage.setItem('harbinger_token', guestToken);
    localStorage.setItem('harbinger_role', 'GUEST');
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setRole(null);
    setStatus('IS_ANONYMOUS');
    localStorage.removeItem('harbinger_token');
    localStorage.removeItem('harbinger_user');
    localStorage.removeItem('harbinger_role');
    localStorage.removeItem('harbinger_guest_token');
  }, []);

  const triggerUpgradePrompt = useCallback(() => setShowUpgradePrompt(true), []);
  const dismissUpgradePrompt = useCallback(() => setShowUpgradePrompt(false), []);

  return (
    <AuthContext.Provider 
      value={{ 
        token, 
        user, 
        status, 
        role,
        isAuthenticated: status === 'IS_AUTHENTICATED',
        isGuest: status === 'IS_GUEST',
        isAdmin: status === 'IS_AUTHENTICATED' && role === 'ADMIN',
        login, 
        setGuestToken,
        logout,
        showUpgradePrompt,
        triggerUpgradePrompt,
        dismissUpgradePrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
