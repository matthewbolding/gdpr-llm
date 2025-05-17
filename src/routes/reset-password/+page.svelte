<script>
  let username = '';
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let success = '';

  async function resetPassword() {
    error = '';
    success = '';
    loading = true;

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match.';
      loading = false;
      return;
    }

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, new_password: newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password.');

      success = data.message;
      username = '';
      newPassword = '';
      confirmPassword = '';
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<main class="container">
  <div class="auth-card">
    <h1>Reset Password</h1>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if success}
      <p class="success">{success}</p>
    {/if}

    <form on:submit|preventDefault={resetPassword}>
      <label for="username">Username:</label>
      <input id="username" bind:value={username} placeholder="Enter username" required />

      <label for="newPassword">New Password:</label>
      <input id="newPassword" type="password" bind:value={newPassword} required />

      <label for="confirmPassword">Confirm Password:</label>
      <input id="confirmPassword" type="password" bind:value={confirmPassword} required />

      <button type="submit" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>

    <p class="login-link">
      <a href="/login">Back to login</a>
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
    background-color: #999;
    cursor: not-allowed;
  }

  .error {
    color: red;
    margin-bottom: 1rem;
    text-align: center;
  }

  .success {
    color: green;
    margin-bottom: 1rem;
    text-align: center;
  }

  .login-link {
    text-align: center;
    margin-top: 1rem;
  }
  
  .login-link a {
    color: #007BFF;
    text-decoration: none;
  }
  
  .login-link a:hover {
    text-decoration: underline;
  }

  * {
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
</style>
