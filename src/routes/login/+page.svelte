<script>
  let username = '';
  let password = '';
  let error = '';
  let loading = false;

  async function loginUser() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      window.location.href = '/';
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<main class="container">
  <div class="auth-card">
    <h1>Login</h1>

    {#if error}
      <p class="error">{error}</p>
    {/if}
    
    <form on:submit|preventDefault={loginUser}>
      <label for="username">Username:</label>
      <input id="username" bind:value={username} type="text" placeholder="Enter username" required />
    
      <label for="password">Password:</label>
      <input id="password" bind:value={password} type="password" placeholder="Enter password" required />
    
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>    

    <p class="register-link">
      Don't have an account? <a href="/register">Register</a>
    </p>

    <p class="register-link">
      <a href="/reset-password">Forgot password?</a>
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
    max-width: 600px;
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

  * {
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>