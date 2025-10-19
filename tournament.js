// Show tournaments created by admins in #tournaments-list
document.addEventListener('DOMContentLoaded', function() {
    // Firebase config (reuse from other pages)
    const firebaseConfig = {
        apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
        authDomain: "authapp-386ee.firebaseapp.com",
        projectId: "authapp-386ee",
        storageBucket: "authapp-386ee.appspot.com",
        messagingSenderId: "809698525310",
        appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
        measurementId: "G-EJZTSBSGQT"
    };
    if (!window.firebase || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    function loadTournaments() {
        const container = document.getElementById('tournaments-list');
        if (!container) return;
        container.innerHTML = '<div class="loading fade-in">Loading tournaments...</div>';

        // Get selected game from query string
        const params = new URLSearchParams(window.location.search);
        const selectedGame = params.get('game');

        let query = db.collection('tournaments')
            .where('createdByRole', '==', 'admin')
            .where('status', '==', 'active');
        if (selectedGame) {
            query = query.where('game', '==', selectedGame);
        }
        query = query.orderBy('startDate', 'asc');
        query.get()
            .then(snapshot => {
                if (snapshot.empty) {
                    container.innerHTML = '<div class="no-data fade-in">No tournaments available</div>';
                    return;
                }
                let html = '';
                let idx = 0;
                snapshot.forEach(doc => {
                    const t = doc.data();
                    html += `<div class='tournament-card fade-in' style="animation-delay:${idx * 0.12}s">
                        <h3>${t.name || 'Unnamed Tournament'}</h3>
                        <div>Game: ${t.game || 'N/A'}</div>
                        <div>Prize: ₹${t.prizePool || 0}</div>
                        <div>Status: ${t.status || 'upcoming'}</div>
                        <div>Start: ${t.startDate ? new Date(t.startDate.seconds*1000).toLocaleString() : 'TBD'}</div>
                    </div>`;
                    idx++;
                });
                container.innerHTML = html;
            })
            .catch(err => {
                console.error('Error loading tournaments:', err);
                container.innerHTML = '<div class="no-data fade-in">Error loading tournaments</div>';
            });
    }
    loadTournaments();
});