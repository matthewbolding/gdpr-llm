<script>
  let username = '';
  let password = '';
  let error = '';
  let loading = false;
  let showPassword = false;

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

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<main class="container">
  <div class="auth-card">
    <h1>Register</h1>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <form on:submit|preventDefault={registerUser}>
      <label for="username">Username:</label>
      <input id="username" bind:value={username} type="text" placeholder="Choose a username" />

      <label for="password">Password:</label>
      <div class="password-wrapper">
        <input
          id="password"
          bind:value={password}
          type={showPassword ? 'text' : 'password'}
          placeholder="Choose a password"
        />
        <button type="button" class="eye-button" on:click={togglePasswordVisibility} aria-label="Toggle password visibility">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" class="feather-eye">
            {#if showPassword}
              <path d="M1 1l22 22"></path>
              <path d="M17.94 17.94A10.5 10.5 0 0 1 12 20c-5.52 0-10-4.48-10-10a10.5 10.5 0 0 1 3.06-7.44"></path>
              <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"></path>
            {:else}
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            {/if}
          </svg>
        </button>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>

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

  .password-wrapper {
    position: relative;
  }

  .eye-button {
    position: absolute;
    top: 50%;
    transform: translateY(-65%);
    right: 0rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .eye-button svg {
    width: 20px;
    height: 20px;
    color: #333;
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

  button[type="submit"] {
    width: 100%;
    padding: 0.6rem;
    font-size: 1rem;
    background-color: #007BFF;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  button[type="submit"]:disabled {
    background-color: #aaa;
    cursor: not-allowed;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>
