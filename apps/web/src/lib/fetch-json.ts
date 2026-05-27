export class FetchJsonError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "FetchJsonError";
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; data?: T }> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...init,
    });
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      const text = (await response.text()).trim();
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: response.status,
          error: "Debés iniciar sesión.",
        };
      }
      if (text.startsWith("<")) {
        return {
          ok: false,
          status: response.status,
          error: "Error del servidor. Recargá la página o volvé a iniciar sesión.",
        };
      }
      return {
        ok: false,
        status: response.status,
        error: text.slice(0, 120) || `Respuesta inválida (${response.status})`,
      };
    }

    const data = (await response.json()) as T;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: (data as { error?: string })?.error ?? `Error ${response.status}`,
        data,
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Error de red",
    };
  }
}

export async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const result = await fetchJson<T>(url, init);
  if (!result.ok) {
    throw new FetchJsonError(result.error, result.status);
  }
  return result.data;
}
