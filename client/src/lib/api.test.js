import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, applyServerErrors, toQuery } from './api.js';

const respond = (status, body) =>
  vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  }));

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('sends JSON with credentials and returns the parsed body', async () => {
    const fetch = respond(200, { ok: true });
    vi.stubGlobal('fetch', fetch);
    expect(await api('/cart', { method: 'POST', body: { qty: 1 } })).toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/cart');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: '{"qty":1}' });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it("turns the server's error envelope into an ApiError with code, fields and details", async () => {
    vi.stubGlobal(
      'fetch',
      respond(409, { error: { code: 'OUT_OF_STOCK', message: 'Only 1 left.', fields: { qty: 'x' }, details: { stock: 1 } } }),
    );
    const err = await api('/orders', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'OUT_OF_STOCK', message: 'Only 1 left.', fields: { qty: 'x' }, details: { stock: 1 } });
  });

  it('still throws a usable ApiError when an error response is not JSON', async () => {
    vi.stubGlobal('fetch', respond(502));
    const err = await api('/orders').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe('Something went wrong.');
  });

  it('reports a network failure as status 0, but lets an abort through untouched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const offline = await api('/cart').catch((e) => e);
    expect(offline).toBeInstanceOf(ApiError);
    expect(offline.status).toBe(0);
    expect(offline.message).toMatch(/reach the server/);

    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    expect(await api('/cart').catch((e) => e)).toBe(abort);
  });
});

describe('applyServerErrors', () => {
  it('maps server field paths onto form fields, renaming where asked', () => {
    const setError = vi.fn();
    const err = new ApiError(400, { error: { fields: { 'shippingAddress.city': 'City is required', couponCode: 'Bad' } } });
    expect(applyServerErrors(err, setError, { 'shippingAddress.city': 'city' })).toBe(true);
    expect(setError).toHaveBeenCalledWith('city', { type: 'server', message: 'City is required' });
    expect(setError).toHaveBeenCalledWith('couponCode', { type: 'server', message: 'Bad' });
  });

  it('leaves the form alone for errors without fields or that are not ApiErrors', () => {
    const setError = vi.fn();
    expect(applyServerErrors(new ApiError(500, null), setError)).toBe(false);
    expect(applyServerErrors(new Error('boom'), setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe('toQuery', () => {
  it('drops empty values and keeps zero and false', () => {
    expect(toQuery({ q: '', page: 0, sale: false, a: undefined, b: null })).toBe('?page=0&sale=false');
    expect(toQuery({})).toBe('');
  });
});
