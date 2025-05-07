<script>
    let username = '';
    let password = '';
    let error = '';
    let loading = false;
  
    async function registerUser() {
      loading = true;
      error = '';
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed');
        window.location.href = '/login';
      } catch (err) {
        error = err.message;
      } finally {
        loading = false;
      }
    }
  </script>
  
  <main class="container">
    <div class="auth-card">
      <h1>Register</h1>
  
      {#if error}
        <p class="error">{error}</p>
      {/if}
  
      <label for="username">Username:</label>
      <input id="username" bind:value={username} type="text" placeholder="Choose a username" />
  
      <label for="password">Password:</label>
      <input id="password" bind:value={password} type="password" placeholder="Choose a password" />
  
      <button on:click={registerUser} disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
  
      <p class="register-link">
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  </main>
  
  <style>
    .container {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }
  
    .auth-card {
      max-width: 400px;
      width: 100%;
      border: 1px solid #ccc;
      padding: 5rem;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      background-color: white;
    }
  
    h1 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      text-align: center;
    }
  
    label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }
  
    input {
      width: 100%;
      padding: 0.5rem;
      margin-bottom: 1rem;
      border-radius: 5px;
      border: 1px solid #ccc;
      font-size: 1rem;
    }
  
    .error {
      color: red;
      margin-bottom: 1rem;
    }
  
    .register-link {
      margin-top: 1rem;
      text-align: center;
    }
  
    a {
      color: #007BFF;
      text-decoration: none;
    }
  
    a:hover {
      text-decoration: underline;
    }
  
    button {
      width: 100%;
      padding: 0.6rem;
      font-size: 1rem;
      background-color: #007BFF;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
  
    button:disabled {
      background-color: #aaa;
      cursor: not-allowed;
    }
  
    :global(body) {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
  </style>
  