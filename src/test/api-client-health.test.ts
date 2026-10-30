import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api-client';

describe('TripSync API Client — Health Probe & Cold Start Diagnostics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pingHealth returns true when actuator endpoint responds with 200 OK', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'UP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const isHealthy = await apiClient.pingHealth(0, 10);
    expect(isHealthy).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/actuator/health');
  });

  it('pingHealth retries on network error and returns false when all retries fail', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const isHealthy = await apiClient.pingHealth(1, 10);
    expect(isHealthy).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('login throws user-friendly cold-start message on fetch failure without hardcoded localhost:8080', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      apiClient.login({ email: 'test@tripsync.io', password: 'password123', rememberMe: false })
    ).rejects.toThrow(/Unable to connect to the TripSync authentication server/);

    try {
      await apiClient.login({ email: 'test@tripsync.io', password: 'password123', rememberMe: false });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).not.toContain('http://localhost:8080');
      expect(msg).toContain('waking up from sleep');
    }
  });

  it('register throws user-friendly cold-start message on fetch failure without hardcoded localhost:8080', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('NetworkError'));

    try {
      await apiClient.register({
        fullName: 'Test Traveler',
        email: 'test@tripsync.io',
        password: 'Password123',
        confirmPassword: 'Password123',
        termsAccepted: true,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).not.toContain('http://localhost:8080');
      expect(msg).toContain('waking up from sleep');
    }
  });
});
