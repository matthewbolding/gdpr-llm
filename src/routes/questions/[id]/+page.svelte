<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { tick } from 'svelte';

  $: id = $page.params.id;

  let question = null;
  let modifiedTexts = {}; // Stores user-modified response text
  let unsavedChanges = false;
  let loading = true; // Tracks loading state

  // Fetch question details
  async function fetchQuestion() {
    loading = true;
    try {
      console.log(`[GET] Fetching question with ID: ${id}`);

      const questionRes = await fetch(`http://localhost:3000/api/question?questionId=${id}`);
      const questionData = await questionRes.json();

      if (!questionData || !questionData.question) {
        console.error("Error: Question not found.");
        question = null;
        return;
      }

      question = questionData.question;

      // Fetch latest responses for this question
      const responsesRes = await fetch(`http://localhost:3000/api/responses?questionId=${id}`);
      const responsesData = await responsesRes.json();

      console.log(`[GET] Responses for question ${id}:`, responsesData);

      question.answers = responsesData.responses || [];

      // Initialize modifiedTexts for each answer
      modifiedTexts = {};
      for (const answer of question.answers) {
        modifiedTexts[answer.response_id] = answer.response_text;
      }

      await tick();
    } catch (error) {
      console.error('Error fetching question or responses:', error);
    } finally {
      loading = false;
    }
  }

  // Handle text changes in textarea
  function updateText(responseId, event) {
    modifiedTexts[responseId] = event.target.value;
    modifiedTexts = Object.assign({}, modifiedTexts); // Ensure reactivity
    unsavedChanges = true;
  }

  // Save changes for a specific response
  async function saveChanges(questionId, responseId, model, status) {
    try {
      const updatedText = modifiedTexts[responseId];

      console.log(`[POST] Saving edits for response ID ${responseId}`);

      await fetch(`http://localhost:3000/api/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionId,
          model: model,
          responseText: updatedText,
          status: status
        })
      });

      unsavedChanges = false;
      alert('Changes saved!');
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Failed to save changes.');
    }
  }

  // Reset text to its original value
  function resetChanges(responseId) {
    if (!question || !question.answers) return;

    const answer = question.answers.find(a => a.response_id === responseId);
    if (answer) {
      modifiedTexts = Object.assign({}, modifiedTexts, { [responseId]: answer.response_text });
    }

    unsavedChanges = false;
  }

  const capitalize = (str, lower = false) =>
    (lower ? str.toLowerCase() : str).replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
  ;

  // Navigate back to home page
  function goToHomePage() {
    goto('/');
  }

  // Warn users before leaving with unsaved changes
  if (typeof window !== 'undefined') {
    window.onbeforeunload = () => {
      if (unsavedChanges) {
        return 'You have unsaved changes!';
      }
    };
  }

  onMount(() => {
    fetchQuestion();
  });
</script>

<main>
  {#if loading}
    <p class="loading">Loading question...</p>
  {:else}
    {#if question}
      <h1 class="title">{question.text}</h1>

      <div class="answer-container">
        {#if question.answers.length > 0}
          <div class="answer-grid">
            {#each question.answers as answer}
              <div class="answer-box">
                <h3 class="model-title">{answer.model}</h3>
                <p class="model">{capitalize(answer.status)}</p>
                <textarea
                  bind:value={modifiedTexts[answer.response_id]}
                  on:input={(event) => updateText(answer.response_id, event)}
                ></textarea>
                
                <div class="button-container">
                  <button class="save-btn" on:click={() => saveChanges(id, answer.response_id, answer.model, "complete")}>Save and Finish</button>
                  <button class="save-btn" on:click={() => saveChanges(id, answer.response_id, answer.model, "in progress")}>Save for Later</button>
                  <button class="reset-btn" on:click={() => resetChanges(answer.response_id)}>Reset</button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="no-answers">No responses available.</p>
        {/if}
      </div>

      <div class="nav-container">
        <button class="home-btn" on:click={goToHomePage}>Back to Home</button>
      </div>
    {:else}
      <p class="error-message">Question not found.</p>
    {/if}
  {/if}
</main>

<style>
  .title {
    text-align: center;
    margin-bottom: 1rem;
  }

  .answer-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .model-title {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .button-container {
    margin-top: 0.5rem;
    display: flex;
    gap: 10px;
  }

  .save-btn, .reset-btn, .home-btn {
    padding: 0.5rem 1rem;
    border: none;
    background-color: #007BFF;
    color: white;
    cursor: pointer;
    border-radius: 5px;
  }

  .reset-btn {
    background-color: #FF9900;
  }

  .home-btn {
    background-color: #28A745;
  }

  .error-message, .loading {
    text-align: center;
    font-size: 1.2rem;
  }

  /* Creates a full-width 2-column grid layout */
  .answer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* Two equal columns */
    gap: 1rem; /* Spacing between grid items */
    width: 100vw; /* Full viewport width */
    padding: 1rem; /* Prevents textboxes from touching screen edges */
  }

  /* Ensures answer boxes are spaced out and readable */
  .answer-box {
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
  }

  /* Makes sure the textarea has proper padding and doesn't touch edges */
  textarea {
    width: 100%;
    height: 120px;
    padding: 1rem; /* Adds padding inside the text area */
    border: 1px solid #ccc;
    border-radius: 5px;
    resize: vertical;
    box-sizing: border-box; /* Ensures padding doesn't affect width */
  }

  /* Responsive layout for smaller screens */
  @media (max-width: 768px) {
    .answer-grid {
      grid-template-columns: 1fr; /* Single column on smaller screens */
    }
  }
</style>
