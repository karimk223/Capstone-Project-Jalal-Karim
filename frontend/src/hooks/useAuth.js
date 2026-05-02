/**
 * useAuth — convenience hook for reading AuthContext.
 * Throws if called outside an <AuthProvider> so misuse fails loudly during dev.
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return ctx;
}
