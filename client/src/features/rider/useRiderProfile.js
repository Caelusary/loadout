import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

// The signed-in rider's details, record and whether they're paused.
export const useRiderProfile = () =>
  useQuery({ queryKey: ['rider-profile'], queryFn: ({ signal }) => api('/rider/profile', { signal }) });
