// Native Next.js client that replaces the Base44 SDK client
// All methods call native Next.js API route handlers (/api/functions/* and /api/entities/*)

class EntityClient {
  constructor(entityName) {
    this.name = entityName;
  }

  async list(sort = 'created_at', limit = 200) {
    const res = await fetch(`/api/entities/${this.name}?sort=${encodeURIComponent(sort)}&limit=${limit}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to list ${this.name}`);
    }
    const data = await res.json();
    return data.items || data;
  }

  async filter(query = {}, sort = 'created_at', limit = 200) {
    const res = await fetch(`/api/entities/${this.name}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sort, limit }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to filter ${this.name}`);
    }
    const data = await res.json();
    return data.items || data;
  }

  async get(id) {
    const res = await fetch(`/api/entities/${this.name}/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to get ${this.name} ${id}`);
    }
    return res.json();
  }

  async create(data) {
    const res = await fetch(`/api/entities/${this.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create ${this.name}`);
    }
    return res.json();
  }

  async update(id, data) {
    const res = await fetch(`/api/entities/${this.name}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update ${this.name}`);
    }
    return res.json();
  }

  async delete(id) {
    const res = await fetch(`/api/entities/${this.name}/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete ${this.name}`);
    }
    return res.json();
  }
}

class FunctionsClient {
  async invoke(functionName, args = {}) {
    const res = await fetch(`/api/functions/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(result.error || `Function ${functionName} failed`);
      err.response = { data: result, status: res.status };
      throw err;
    }
    return { data: result };
  }
}

class AuthClient {
  async me() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return res.json();
  }

  logout() {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  redirectToLogin() {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export const base44 = {
  functions: new FunctionsClient(),
  auth: new AuthClient(),
  entities: new Proxy({}, {
    get: (target, entityName) => {
      if (!target[entityName]) {
        target[entityName] = new EntityClient(entityName);
      }
      return target[entityName];
    }
  }),
  asServiceRole: {
    entities: new Proxy({}, {
      get: (target, entityName) => {
        if (!target[entityName]) {
          target[entityName] = new EntityClient(entityName);
        }
        return target[entityName];
      }
    }),
  }
};

export const api = base44;
