# SVC-Senior-Project-2025-2026
SVC CLP Sign in and dashboard system

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Our Architecture

The CLP Dashboard is built using a modern three-tier architecture:

### Frontend
- **React + TypeScript**: Type script is the language we are using for frontend use, while react is our backend stuff.
- **React Router**: Client-side routing for navigation between login and role-based dashboards (Student, Professor, Admin)

### Backend / APIs
- **Private Apache Web Server**: Hosts the application and exposes RESTful APIs
- **Database**: Private server database storing user credentials, student data, professor information, and admin records
- **API Endpoints**: Custom endpoints that retrieve and manage data from the private database

### Deployment
- Application runs entirely on a private server with Apache
- App communicates with backend APIs for authentication and data retrieval
- All data is stored and managed securely on the private server database

### Current Development Setup (Mock Server)
During development, a mock JSON Server (`server.js`) simulates the backend APIs for testing login functionality and dashboard features before deployment to production.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.