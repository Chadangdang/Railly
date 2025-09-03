document.getElementById('search-btn').addEventListener('click', function () {
    const source = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    let date = document.getElementById('date').value;

    if (!source || !destination || !date) {
        alert("Please select all fields!");
        return;
    }

    // Reformat the date to yyyy/mm/dd
    const dateParts = date.split('-'); // ['yyyy', 'mm', 'dd']
    date = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;

    // AJAX request
    fetch('search_trains.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            source: source,
            destination: destination,
            date: date,
        }),
    })
    .then((response) => response.json())
    .then((data) => {
        const resultsDiv = document.getElementById('ticket-results');
        resultsDiv.innerHTML = ''; // Clear previous results

        if (data.error) {
            resultsDiv.innerHTML = `<p>${data.error}</p>`;
            return;
        }

        data.forEach((train) => {
            const trainDiv = document.createElement('div');
            trainDiv.classList.add('ticket');
            trainDiv.innerHTML = `
                <p>${train.departure_time} ${train.source} - ${train.arrival_time} ${train.destination}</p>
                <p>Train number: ${train.train_name}</p>
                <p>${train.price} THB per person</p>
                <button>Select</button>
            `;
            resultsDiv.appendChild(trainDiv);
        });
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`An error occurred: ${error.message}`);
    });
});