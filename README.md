# CDS Bhuta Sculpture Prototype

This is a web-based prototype for displaying and interacting with a Bhuta sculpture model.

The current version is built with Next.js, React Three Fiber, Three.js, and Drei. It displays a 3D sculpture on a pedestal, supports horizontal mouse rotation, and includes background music with a sound toggle button.

## Tech Stack

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- Drei
- Tailwind CSS

## Getting Started

### 1. Install Node.js

Before running the project, make sure Node.js is installed on your computer.

Check the installation with:

```bash
node -v
npm -v

If both commands return version numbers, Node.js and npm are installed correctly.

2. Clone the Repository
git clone <repository-url>
cd <repository-folder>

Replace <repository-url> with the GitHub repository URL, and <repository-folder> with the name of the cloned project folder.

3. Install Dependencies

Inside the project folder, run:

npm install

This installs all required packages, including Next.js, React, Three.js, React Three Fiber, and Drei.

4. Run the Development Server

Start the local development server:

npm run dev

Then open the project in your browser:

http://localhost:3000
5. Stop the Development Server

To stop the local development server, press:

Ctrl + C

in the terminal.

Development Notes

The current prototype includes:

A 3D Bhuta sculpture model
A simple pedestal
Horizontal mouse rotation
Disabled zooming and panning
Background music
A sound toggle button in the upper-right corner

Most browsers block automatic audio playback with sound. If the music does not start automatically, click the sound button once to enable it.

Future Development

Planned or possible future features include:

A dark Bhuta Kola video background
Interaction-triggered background changes
Sculpture color restoration during rotation
Mobile device orientation control
TouchDesigner-based control through WebSocket
A more polished exhibition-style interface