export function initAuth() {
    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
        // Prevent duplicate bindings
        signinForm.replaceWith(signinForm.cloneNode(true));
        document.getElementById('signinForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('adagio_token', result.token);
                    const { navigate } = await import('../router.js');
                    navigate('/index.html');
                } else alert(result.message);
            } catch (err) { alert('An error occurred during sign in.'); }
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Prevent duplicate bindings
        signupForm.replaceWith(signupForm.cloneNode(true));
        document.getElementById('signupForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    const { navigate } = await import('../router.js');
                    navigate('/signin.html');
                }
            } catch (err) { alert('An error occurred during registration.'); }
        });
    }
}
