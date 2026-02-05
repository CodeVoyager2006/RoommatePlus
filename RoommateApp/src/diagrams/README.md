# Project Architecture

## Overview

This is a roommate management app built with React. It helps roommates manage chores, chat with each other, and track laundry machine availability.

---

## File Structure

### Entry Point

- **main.jsx** - Starts the app and renders the main App component

### Main Component

- **App.jsx** - Controls navigation and shows different pages

### Page Components

- **Chores.jsx** - Manages household chores
- **Chat.jsx** - Group messaging system
- **Machine.jsx** - Tracks washing machine availability
- **Setting.jsx** - User settings

---

## How It Works

### App.jsx (Router)

App.jsx decides which page to show based on a `route` state variable.

**What it manages:**

- Current page (chores, chat, machine, or settings)
- Navigation between pages

**What it renders:**

- Header (at top)
- One page component (in middle)
- MenuBar (at bottom)

When you click a menu button, it updates the route and shows a different page.

---

### Chores.jsx

Manages chores for multiple roommates.

**What it manages:**

- List of roommates and their chores
- Selected chore (for viewing details)
- Create chore modal state

**Main features:**

- Create new chores
- View chore details
- Delete chores
- Assign chores to multiple people

**Child components:**

- ChoresWidget - Shows chores for one roommate
- ChoresPopup - Shows details when you click a chore
- CreateChores - Form to create new chores

---

### Chat.jsx

Group messaging with thread-based conversations.

**What it manages:**

- List of members
- List of conversation threads
- Current view (thread list, member list, or single thread)
- Selected thread
- New message input

**Main features:**

- Create conversation threads
- Post messages to threads
- View member list
- AI-generated thread summaries

**Child components:**

- MembersBanner - Shows member avatars
- ThreadCard - Preview of a conversation
- MembersList - Full list of members
- ThreadView - Full conversation with messages
- NewThreadModal - Form to create new thread

---

### Machine.jsx

Tracks machine availability.

**What it manages:**

- List of machines
- Each machine's status (available or busy)
- Who is using each machine
- Selected machine
- Add machine modal state
- Toast notifications

**Main features:**

- Mark machine as occupied
- Mark machine as finished
- Add new machines
- Prevent double-booking

**Child components:**

- MachineWidget - Card for each machine
- MachineInfo - Details and actions for a machine
- AddMachine - Form to add new machine

---

### Setting.jsx

Simple placeholder page for future settings functionality.

---

## Data Flow

### State Management

Each page component manages its own state:

- **App.jsx** - Current route
- **Chores.jsx** - Roommates and chores
- **Chat.jsx** - Threads and messages
- **Machine.jsx** - Machines and their status
