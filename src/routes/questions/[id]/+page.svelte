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

  let hoursWorked = ""; // Input field for the number of hours worked
  let latestHoursWorked = 0; // Stores the most recent saved hours

  let ratingText = ""; // Stores the rating input field
  let latestRating = ""; // Stores the most recent saved rating

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
      fetchQuestion();
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

      // Fetch the latest recorded hours for this question
      await fetchHoursWorked();
      await fetchRating();

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

  // Fetch the most recent recorded hours for this question
  async function fetchHoursWorked() {
    try {
      const res = await fetch(`http://localhost:3000/api/duration?questionId=${id}`);
      if (!res.ok) throw new Error("No previous duration found");

      const data = await res.json();
      latestHoursWorked = data.hours_spent;
    } catch (error) {
      console.error("Error fetching hours worked:", error);
      latestHoursWorked = null; // No previous record
    }
  }

  // Save the entered number of hours worked
  async function saveHoursWorked() {
    const hours = parseFloat(hoursWorked);
    if (isNaN(hours) || hours <= 0) {
      alert("Please enter a valid number of hours.");
      return;
    }

    try {
      console.log(`[POST] Saving ${hours} hours for question ID ${id}`);

      await fetch(`http://localhost:3000/api/duration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, hoursSpent: hours })
      });

      hoursWorked = ""; // Clear the input field
      await fetchHoursWorked(); // Refresh displayed hours
      alert("Hours worked saved successfully!");
    } catch (error) {
      console.error("Error saving hours worked:", error);
      alert("Failed to save hours.");
    }
  }

  // Fetch the most recent rating for this question
  async function fetchRating() {
    try {
      const res = await fetch(`http://localhost:3000/api/rating?questionId=${id}`);
      if (!res.ok) throw new Error("No previous rating found");

      const data = await res.json();
      latestRating = data.text;
      ratingText = data.text;
    } catch (error) {
      console.error("Error fetching rating:", error);
      latestRating = "";
      ratingText = "";
    }
  }

  // Save rating text
  async function saveRating() {
    if (!ratingText.trim()) {
      alert("Rating text cannot be empty.");
      return;
    }

    try {
      console.log(`[POST] Saving rating for question ID ${id}`);

      await fetch(`http://localhost:3000/api/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, text: ratingText })
      });

      await fetchRating(); // Refresh displayed rating
      alert("Rating saved successfully!");
    } catch (error) {
      console.error("Error saving rating:", error);
      alert("Failed to save rating.");
    }
  }

  const capitalize = (str, lower = false) =>
    (lower ? str.toLowerCase() : str).replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
  ;

  // Navigate back to home page
  function goToHomePage() {
    goto('/');
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

      <div class="metadata-grid">
        <!-- Duration Entry -->
        <div class="metadata-box">
          <h3>Track Your Time</h3>
          <p>Latest recorded time: {latestHoursWorked !== null ? `${latestHoursWorked} hours` : "No record yet"}</p>
          <input type="number" bind:value={hoursWorked} min="0.1" step="0.1" placeholder="Enter hours worked" />
          <button class="save-btn" on:click={saveHoursWorked}>Save Hours</button>
        </div>

        <!-- Rating Entry -->
        <div class="metadata-box">
          <h3>Rating</h3>
          <p>Latest rating: {latestRating || "No rating yet"}</p>
          <textarea bind:value={ratingText}></textarea>
          <button class="save-btn" on:click={saveRating}>Save Rating</button>
        </div>
      </div>

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
                  <button class="save-finish-btn" on:click={() => saveChanges(id, answer.response_id, answer.model, "complete")}>Save and Finish</button>
                  <button class="save-later-btn" on:click={() => saveChanges(id, answer.response_id, answer.model, "in progress")}>Save for Later</button>
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
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    width: 100vw;
    padding: 1rem;
  }

  .metadata-box {
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
  }

  .answer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    width: 100vw;
    padding: 1rem;
  }

  .answer-box {
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
  }

  .save-finish-btn, .save-later-btn, .reset-btn, .home-btn {
    padding: 0.5rem 1rem;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 5px;
  }

  .save-finish-btn {
    background-color: #59ac4b;
  }

  .save-later-btn {
    background-color: #84a3ff;
  }

  .reset-btn {
    background-color: #ffca80;
  }

  .home-btn {
    background-color: #007BFF;
  }

  textarea {
    width: 100%;
    height: 80px;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 5px;
    resize: vertical;
    box-sizing: border-box;
  }
</style>
