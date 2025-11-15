## Table of contents 
1. Overview 
2. High-level architecture 
3. How files interact with each other

## Overview 
The project is a single-page React application built with
modular components. Core state is managed in App.jsx using useState, and
the UI is composed of Header, MenuBar, and feature components such as
Chores, Chat, Machine, and Setting.

## High-level architecture 
- Presentation layer: React functional components for UI rendering. 
- State layer: Local state in App.jsx; child components hold their own internal state. 
- Styling: CSS files colocated with components or in shared locations.

## How files interact with each other 
- index.jsx mounts the App component. 
- App.jsx manages routing state and decides which feature component to display. 
- Header and MenuBar are persistent components rendered on all routes. 
- MenuBar sends route changes back to App.jsx via callback props. 
- Each feature component (Chores, Chat, Machine, Setting) is rendered conditionally based on the current route.
