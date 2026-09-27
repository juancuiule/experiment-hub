import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRun, send } from '@/src/data/send';

const meta = {
  runId: 'run-1',
  token: 'signed-token',
  experiment: 'ocean',
  checkpoint: 'mid',
  seq: 3,
};

describe('send', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the context snapshot to the checkpoint endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const context = { data: { intro: { answer: 5 } } };
    await send(context, meta);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/runs/run-1/checkpoints');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.experiment).toBe('ocean');
    expect(body.checkpoint).toBe('mid');
    expect(body.seq).toBe(3);
    expect(body.context).toEqual(context);
    expect(typeof body.at).toBe('string');
    expect(init.headers['X-Run-Token']).toBe('signed-token');
  });

  it('encodes special characters in the run id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await send({}, { ...meta, runId: 'run/with spaces' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/runs/run%2Fwith%20spaces/checkpoints',
    );
  });

  it('throws when the backend rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
    );

    await expect(send({}, meta)).rejects.toThrow('HTTP 500');
  });

  it('propagates network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection refused')),
    );

    await expect(send({}, meta)).rejects.toThrow('connection refused');
  });

  it('createRun() registers a run and returns the issued id + token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"runId":"r-9","token":"t-9"}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createRun('ocean')).resolves.toEqual({
      runId: 'r-9',
      token: 't-9',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/runs');
    expect(JSON.parse(init.body)).toEqual({ experiment: 'ocean' });
  });

  it('createRun() throws when the backend refuses the run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 404 })),
    );
    await expect(createRun('made-up')).rejects.toThrow('HTTP 404');
  });
});
