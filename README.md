# Railly

Railly is a web-based railway ticketing platform built for the CSS326 Database Programming Laboratory project. It provides passenger-facing booking and payment flows alongside staff tools for validating and reviewing tickets.

## Branches and deployments
- **develop**: Final code product. Use this branch for local development and reviewing the complete feature set.
- **production**: Deployment branch tailored for InfinityFree hosting. Static assets and PHP endpoints from this branch power the live site.
  - User-facing site: https://railly.great-site.net/Page/user/Home/home.html
  - Staff portal login: https://railly.great-site.net/Page/staff/auth/login.html

> This README lives on `main` to document both branches.

## Tech stack
- **Frontend**: HTML, CSS, and vanilla JavaScript (see `Page/user` for the customer experience and `Page/staff` for admin tooling).
- **Backend**: PHP 8+ endpoints in `Backend/` for authentication, booking, ticket verification, and station data.
- **Data**: MySQL, with separate connection profiles for local MAMP and production InfinityFree (`Backend/db_connection.php`).
- **Tooling**: Composer (Dotenv) for optional environment variable management.

## Project structure
- `Page/user`: Passenger flows (home, booking, cart, payment, tickets, profile, auth, shared components).
- `Page/staff`: Staff authentication and ticket verification pages.
- `Backend`: PHP APIs for login/signup, ticket operations, station lookup, staff history, and session handling.
- `assets` & `index.css`: Shared static assets and root styling.

## Running locally
1. Install PHP 8+, Composer, and a MySQL server (MAMP defaults are supported).
2. Clone the repository and check out the `develop` branch for the full codebase.
3. From `Backend/`, run `composer install` (optional; only needed for Dotenv support).
4. Create a MySQL database (default name `railly`) and import your schema/data.
5. Update `Backend/.env` (optional) or edit `Backend/db_connection.php` if your database credentials differ from the defaults.
6. Serve the project via your preferred PHP-capable web server (e.g., MAMP at http://localhost:8888). The app auto-detects production vs. local based on the host name.

## Credits
Prepared by **Chdang Phummarin (ID: 6522770591)** as part of the CSS326 Database Programming Laboratory project.