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

```
bash
node -v
npm -v
```

If both commands return version numbers, Node.js and npm are installed correctly.

### 2. Clone the Repository
git clone <repository-url>
cd <repository-folder>

Replace <repository-url> with the GitHub repository URL, and <repository-folder> with the name of the cloned project folder.

### 3. Install Dependencies

Inside the project folder, run:

npm install

This installs all required packages, including Next.js, React, Three.js, React Three Fiber, and Drei.

### 4. Run the Development Server

Start the local development server:

npm run dev

Then open the project in your browser:

http://localhost:3000

### 5. Stop the Development Server

To stop the local development server, press:

Ctrl + C

in the terminal.

### 6. Connect Zig Sim to Control Rotation

The app receives Zig Sim phone sensor data via HTTP POST and rotates the sculpture in real-time.

#### Step 1: Get Your PC's IP Address

Zig Sim on your phone needs to know your PC's network address.

**Windows:**

Open PowerShell and run:
```powershell
ipconfig
```

Look for **IPv4 Address** (starts with `192.168` or `10.`, not `127.0.0.1`).

From the earlier output, your IP is: `172.20.10.2`

#### Step 2: Configure Zig Sim Output

In Zig Sim app:

1. Set output method to **HTTP POST**
2. Set target URL to: `http://172.20.10.2:3000`
   - (Just the IP and port, no path needed)

3. Send JSON payload with one of these formats:

```json
{ "yaw": 35.5 }
```

```json
{ "attitude": { "yaw": 35.5 } }
```

```json
{ "rotation": { "y": 35.5 } }
```

```json
{ "data": { "yaw": 35.5 } }
```

#### How It Works

- Zig Sim sends your phone's yaw angle via HTTP POST to `http://172.20.10.2:3000`
- The app receives the data and saves the latest packets
- Frontend polls every 100ms and smoothly rotates the sculpture to match

#### Debugging

- **View received data**: Open browser and go to `http://localhost:3000/api/zigsim` or `http://localhost:3000/`
- **Check server logs**: Look at terminal where you ran `npm run dev` for incoming POST requests
- **Connection issues**: Ensure PC and phone are on same network, firewall allows port 3000

### Development Notes

The current prototype includes:

A 3D Bhuta sculpture model
A simple pedestal
Horizontal mouse rotation
Disabled zooming and panning
Background music
A sound toggle button in the upper-right corner

Most browsers block automatic audio playback with sound. If the music does not start automatically, click the sound button once to enable it.