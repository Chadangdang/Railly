<?php
// Start the session
session_start();

// Include the database connection
include '../Backend/db_connection.php';

// Check if the request is POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the JSON payload from the request
    $data = json_decode(file_get_contents('php://input'), true);

    // Check if payload contains required fields
    if (!isset($data['username'], $data['password'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid input data.']);
        exit;
    }

    // Extract fields from the payload
    $username = trim($data['username']);
    $password = trim($data['password']);

    // Validate input data
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }

    // Prepare and execute the SQL query
    $sql = "SELECT * FROM signup WHERE username = ?";
    $stmt = $conn->prepare($sql);

    if ($stmt) {
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();

        // Check if user exists
        if ($result->num_rows > 0) {
            $signup = $result->fetch_assoc();

            // Verify the password
            if (password_verify($password, $signup['pass'])) {
                // Set session variables for the logged-in user
                $_SESSION['user_id'] = $signup['id'];
                $_SESSION['username'] = $signup['username'];
                $_SESSION['email'] = $signup['email'];

                // Return a successful response
                echo json_encode([
                    'success' => true,
                    'message' => 'Login successful!',
                    'user' => [
                        'id' => $signup['id'],
                        'username' => $signup['username'],
                        'email' => $signup['email']
                    ]
                ]);
            } else {
                // Invalid password
                echo json_encode(['success' => false, 'message' => 'Invalid password.']);
            }
        } else {
            // User not found
            echo json_encode(['success' => false, 'message' => 'User not found.']);
        }

        $stmt->close();
    } else {
        // SQL preparation error
        echo json_encode(['success' => false, 'message' => 'Database query failed.']);
    }
} else {
    // If the method is not POST, return a 405 error
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}

// Close the database connection
$conn->close();
