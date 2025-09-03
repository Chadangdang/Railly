<?php
// Include the database connection
include '../Backend/db_connection.php'; // Make sure this path is correct

// Check if the request is POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the JSON payload from the request
    $data = json_decode(file_get_contents('php://input'), true);

    // Extract fields from the payload
    $username = $data['username'];
    $email = $data['email'];
    $password = $data['password'];

    // Validate the input data
    if (empty($username) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }

    // Check if the username or email already exists in the database
    $check_sql = "SELECT * FROM signup WHERE username = ? OR email = ?";
    $check_stmt = $conn->prepare($check_sql);
    $check_stmt->bind_param("ss", $username, $email);
    $check_stmt->execute();
    $result = $check_stmt->get_result();

    if ($result->num_rows > 0) {
        // If a record is found, announce that the username or email is already in use
        echo json_encode(['success' => false, 'message' => 'This username or email is already in use. Please try another one.']);
        $check_stmt->close();
        $conn->close();
        exit;
    }
    $check_stmt->close();

    // If no duplicate is found, proceed with the signup
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Prepare the SQL query to insert data
    $sql = "INSERT INTO signup (username, email, pass) VALUES (?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sss", $username, $email, $hashed_password);
    
    // Execute the query and check for success
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Signup successful!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'An error occurred while signing up. Please try again.']);
    }

    // Close the prepared statement and database connection
    $stmt->close();
    $conn->close();
} else {
    // Return a 405 Method Not Allowed response for unsupported request types
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
?>
