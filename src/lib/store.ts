import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
  emailVerified: boolean;
}

interface Site {
  id: string;
  name: string;
  domain: string;
  apiKey: string;
}

interface AppState {
  user: User | null;
  sites: Site[];
  currentSite: Site | null;
  token: string | null;

  setUser: (user: User | null) => void;
  setSites: (sites: Site[]) => void;
  setCurrentSite: (site: Site | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  sites: [],
  currentSite: null,
  token: null, // Always null on server; rehydrated on client via DashboardClient useEffect

  setUser: (user) => set({ user }),
  setSites: (sites) => set({ sites }),
  setCurrentSite: (site) => set({ currentSite: site }),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('posh_token', token);
      else localStorage.removeItem('posh_token');
    }
    set({ token });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('posh_token');
    }
    set({ user: null, sites: [], currentSite: null, token: null });
  },
}));
