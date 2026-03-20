import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Set dev defaults if not present
if (!localStorage.getItem('core-user-id')) {
  localStorage.setItem('core-user-id', crypto.randomUUID());
}
if (!localStorage.getItem('core-user-role')) {
  localStorage.setItem('core-user-role', 'platform_admin');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
