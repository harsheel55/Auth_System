document.getElementById('signup-form').addEventListener('submit', async function(event) {
    event.preventDefault();
  
    const formData = {
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      phone: document.getElementById('phone').value,
    };
  
    const messageElement = document.getElementById('message');
    
    // Validation for password length
    if (formData.password.length < 8) {
      messageElement.textContent = 'Password must be at least 8 characters long.';
      messageElement.style.color = 'red';
      messageElement.style.display = 'block';
      return;
    }
  
    try {
      const response = await fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
  
      const result = await response.json();
  
      if (response.ok) {
        messageElement.textContent = 'User created successfully! Please check your email to verify your account.';
        messageElement.style.color = 'green';
      } else {
        messageElement.textContent = result.message || 'An error occurred. Please try again.';
        messageElement.style.color = 'red';
      }
  
    } catch (error) {
      messageElement.textContent = 'An error occurred. Please try again.';
      messageElement.style.color = 'red';
    }
  
    messageElement.style.display = 'block';
  });
  